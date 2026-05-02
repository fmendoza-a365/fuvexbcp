import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';

// ── Tipos ──────────────────────────────────────────────────
export interface HistoricoEntry {
  fecha: string;
  mes: string;
  numEntidades: string;
  deudaTotal: string;
  porNOR: string;
  porCPP: string;
  porDEF: string;
  porDUD: string;
  porPER: string;
}

export interface LineaCredito {
  entidad: string;
  lineaAprobada: string;
  lineaNoUtilizada: string;
  lineaUtilizada: string;
}

export interface DetalleDeuda {
  entidad: string;
  campos: Record<string, string>;
}

export interface RCCResult {
  dni: string;
  nombres: string;
  semaforo: 'VERDE' | 'AMARILLO' | 'ROJO' | 'GRIS';
  semaforoPrevio: 'VERDE' | 'AMARILLO' | 'ROJO' | 'GRIS';
  deudaTotal: number;
  ultimaActualizacion: string;
  documento: string;
  flagNoContactar: boolean;
  motivoCaida: string;
  score: string;
  filtroVehicular: string;
  producto: string;
  colorDxP: string;
  infoGeneral: {
    nombres: string;
    documento: string;
    nacimiento: string;
    sexo: string;
    estadoCivil: string;
  };
  ruc: {
    ruc: string;
    razonSocial: string;
    giro: string;
    estado: string;
    tipo: string;
    condicion: string;
  };
  historico: HistoricoEntry[];
  lineasCredito: LineaCredito[];
  detalleDeuda: DetalleDeuda[];
  otros: Record<string, string>[];
}

// ── Credenciales (Desde Variables de Entorno) ──────────────
const URL_LOGIN = 'https://infoburo.com.pe/Home/Index';
const URL_RCC   = 'https://infoburo.com.pe/RccConsulta/RccConsulta?idbc=2';
const USUARIO   = process.env.INFOBURO_USER || '';
const PASSWORD  = process.env.INFOBURO_PASS || '';

if (!USUARIO || !PASSWORD) {
  console.warn('[INFOBURO] ⚠️ Advertencia: No se han configurado las credenciales de Infoburo en el archivo .env');
}

// ── Caché simple en memoria ────────────────────────────────
const cache = new Map<string, { data: RCCResult; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

// ── Sesión persistente ─────────────────────────────────────
let persistentBrowser: Browser | null = null;
let persistentPage: Page | null = null;
let sessionActive = false;

export async function getBrowserAndPage(): Promise<{ browser: Browser; page: Page }> {
  if (persistentBrowser && persistentPage && sessionActive) {
    try {
      await persistentPage.evaluate(() => document.title);
      return { browser: persistentBrowser, page: persistentPage };
    } catch {
      sessionActive = false;
      try { await persistentBrowser.close(); } catch {}
      persistentBrowser = null;
      persistentPage = null;
    }
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1400,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  await page.goto(URL_LOGIN, { waitUntil: 'networkidle2', timeout: 20000 });
  await page.waitForSelector('#txt_User', { timeout: 10000 });
  await page.type('#txt_User', USUARIO);
  await page.type('#txt_Password', PASSWORD);
  await page.click('#btn_login');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });

  console.log('[INFOBURO] ✓ Login exitoso');

  persistentBrowser = browser;
  persistentPage = page;
  sessionActive = true;

  // Manejar alertas nativas (como la de "No hay datos")
  page.on('dialog', async dialog => {
    const msg = dialog.message();
    console.log(`[INFOBURO] Alerta detectada: "${msg}"`);
    if (msg.includes('No hay datos') || msg.includes('datos')) {
      console.log('[INFOBURO] Aceptando alerta para esperar carga real...');
      await dialog.accept();
    } else {
      await dialog.accept();
    }
  });

  return { browser, page };
}

// ── Helper: detectar color de semáforo ─────────────────────
function detectarSemaforo(clases: string): 'VERDE' | 'AMARILLO' | 'ROJO' | 'GRIS' {
  const c = clases.toLowerCase();
  if (c.includes('green') || c.includes('verde')) return 'VERDE';
  if (c.includes('yellow') || c.includes('amarillo')) return 'AMARILLO';
  if (c.includes('red') || c.includes('rojo')) return 'ROJO';
  return 'GRIS';
}

// ── Helper: clic en tab y esperar ──────────────────────────
async function clickTab(page: Page, tabName: string): Promise<void> {
  await page.evaluate((name: string) => {
    const links = Array.from(document.querySelectorAll('a'));
    for (const link of links) {
      if (link.textContent?.trim() === name) {
        link.click();
        return;
      }
    }
  }, tabName);
  // Esperar a que la tabla cambie o aparezca el th de la nueva sección
  try {
    await page.waitForSelector('table', { timeout: 3000 });
  } catch {}
}

// ── Consulta principal ─────────────────────────────────────
export async function consultarRCC(dni: string): Promise<RCCResult> {
  // Verificar caché
  const cached = cache.get(dni);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    console.log(`[INFOBURO] ✓ Resultado en caché para DNI: ${dni}`);
    return cached.data;
  }

  const { page } = await getBrowserAndPage();

  try {
    // Navegar a RCC
    console.log(`[INFOBURO] Navegando a URL_RCC...`);
    await page.goto(URL_RCC, { waitUntil: 'load', timeout: 30000 });
    console.log(`[INFOBURO] Esperando selector #Documento_filter...`);
    await page.waitForSelector('#Documento_filter', { timeout: 15000 });
    console.log(`[INFOBURO] Selector encontrado. Escribiendo DNI...`);

    // Limpiar y escribir DNI de forma ultra-robusta
    await page.evaluate((d: string) => {
      const input = document.querySelector('#Documento_filter') as HTMLInputElement;
      if (input) {
        input.value = d;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
      }
    }, dni);
    
    // Verificar que se escribió correctamente
    const val = await page.$eval('#Documento_filter', (el: any) => el.value);
    if (val !== dni) {
      await page.focus('#Documento_filter');
      await page.keyboard.down('Control');
      await page.keyboard.press('A');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      await page.type('#Documento_filter', dni, { delay: 100 });
    }

    console.log(`[INFOBURO] Enviando búsqueda para DNI ${dni}...`);
    await page.keyboard.press('Enter');
    
    // Intentar clic en el botón solo si Enter no parece haber disparado nada
    await new Promise(r => setTimeout(r, 200));
    const isSearching = await page.evaluate(() => !!document.querySelector('.swal2-loading'));
    if (!isSearching) {
      try {
        await page.evaluate(() => {
          const btn = document.querySelector('#btnListar') as HTMLElement;
          if (btn) btn.click();
        });
      } catch {}
    }

    // Manejar popup "NO CONTACTAR"
    console.log(`[INFOBURO] Buscando popups...`);
    let flagNoContactar = false;
    try {
      await page.waitForSelector('.swal2-confirm', { timeout: 5000 });
      const popupText = await page.evaluate(() => {
        const el = document.querySelector('.swal2-title, .swal2-content, .swal2-html-container');
        return el?.textContent || '';
      });
      flagNoContactar = popupText.toLowerCase().includes('no contactar');
      await page.click('.swal2-confirm');
      await new Promise(r => setTimeout(r, 1500));
    } catch {
      // Sin popup
    }

    // Esperar a que la tabla tenga datos o aparezca error
    try {
      console.log(`[INFOBURO] Esperando respuesta del servidor...`);
      await page.waitForFunction((d: string) => {
        const bodyText = document.body.innerText;
        // Exito o Fallo controlado
        return bodyText.includes('DNI: ' + d) || 
               bodyText.includes('DNI:' + d) || 
               bodyText.includes('No se encontraron registros') ||
               !!document.querySelector('.swal2-html-container');
      }, { timeout: 35000 }, dni);
    } catch (err) {
      console.log(`[INFOBURO] ✗ Timeout total esperando resultados.`);
      throw new Error('El servidor de Infoburo no respondió a tiempo.');
    }
    
    // Pequeño margen para que el DOM se asiente
    await new Promise(r => setTimeout(r, 300));
    
    // Verificar si realmente hay datos o fue un mensaje de "No encontrado"
    const isNoFound = await page.evaluate((d: string) => {
      const bodyText = document.body.innerText;
      const hasDNI = bodyText.includes('DNI: ' + d) || bodyText.includes('DNI:' + d);
      return !hasDNI;
    }, dni);

    if (isNoFound) {
      console.log(`[INFOBURO] ! DNI ${dni} no devolvió registros.`);
      // Retornar un resultado vacío pero válido para que la App no explote
      return {
        dni,
        nombres: 'No encontrado / Sin historial',
        semaforo: 'GRIS',
        semaforoPrevio: 'GRIS',
        deudaTotal: 0,
        ultimaActualizacion: '',
        documento: 'DNI: ' + dni,
        flagNoContactar: false,
        motivoCaida: 'DNI sin registros en Infoburo',
        score: '',
        filtroVehicular: '',
        producto: '',
        colorDxP: '',
        infoGeneral: { nombres: '', documento: dni, nacimiento: '', sexo: '', estadoCivil: '' },
        ruc: { ruc: '', razonSocial: '', giro: '', estado: '', tipo: '', condicion: '' },
        historico: [],
        lineasCredito: [],
        detalleDeuda: [],
        otros: [],
      };
    }

    // ═══════════════════════════════════════════════════════
    // FASE 1: Extraer cabecera (nombre, semáforo, tabla resumen)
    // ═══════════════════════════════════════════════════════
    const cabecera = await page.evaluate(() => {
      function getFieldByLabel(label: string): string {
        const tds = Array.from(document.querySelectorAll('td'));
        for (let i = 0; i < tds.length; i++) {
          if (tds[i].textContent?.trim() === label && tds[i + 1]) {
            return tds[i + 1].textContent?.trim() || '';
          }
        }
        return '';
      }

      // Nombre
      let nombres = '';
      const allBold = document.querySelectorAll('b, strong');
      for (const el of allBold) {
        const t = el.textContent?.trim() || '';
        if (t.length > 5 && t === t.toUpperCase() && !t.includes('ACTUALIZAR') && !t.includes('DNI')) {
          nombres = t;
          break;
        }
      }
      if (!nombres) {
        const bodyText = document.body.innerText;
        const match = bodyText.match(/([A-ZÁÉÍÓÚÑ]{2,}\s+[A-ZÁÉÍÓÚÑ]{2,}\s+[A-ZÁÉÍÓÚÑ]{2,}(?:\s+[A-ZÁÉÍÓÚÑ]{2,})?)\s*(?:Actualizar|Fecha)/);
        if (match) nombres = match[1].trim();
      }
      if (!nombres) nombres = getFieldByLabel('Nombres');

      // Tabla resumen
      let documento = '';
      let ultimaActualizacion = '';
      let montoTotal = 0;
      const dataRows = document.querySelectorAll('tbody tr');
      for (const row of dataRows) {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 3) {
          const firstCell = cells[0]?.textContent?.trim().replace(/\s+/g, ' ') || '';
          if (firstCell.includes('DNI')) {
            const dniMatch = firstCell.match(/(DNI:\s*\d{8})/);
            documento = dniMatch ? dniMatch[1] : firstCell;
            ultimaActualizacion = cells[1]?.textContent?.trim() || '';
            const montoText = cells[2]?.textContent?.trim() || '0';
            montoTotal = parseFloat(montoText.replace(/,/g, '')) || 0;
            break;
          }
        }
      }

      // Semáforos
      let semActualClass = '';
      let semPrevioClass = '';
      const allCells = document.querySelectorAll('td');
      let foundSemActual = false;
      for (const cell of allCells) {
        const circle = cell.querySelector('i, span, div');
        if (circle) {
          const classes = circle.className || '';
          if (classes.includes('circle') || classes.includes('semaforo') || classes.includes('fa-circle')) {
            if (!foundSemActual) {
              semActualClass = classes;
              foundSemActual = true;
            } else {
              semPrevioClass = classes;
              break;
            }
          }
        }
      }

      // Campos superiores
      const bodyText = document.body.innerText;
      const scoreMatch = bodyText.match(/Score:\s*([\d.]+)/);
      const motivoMatch = bodyText.match(/Motivo de caida dxp:\s*([^\n\r]*?)(?=\s{2,}|Filtro|Score|Flag|$)/);
      const filtroMatch = bodyText.match(/Filtro Vehicular:\s*([^\n\r]*?)(?=\s{2,}|Score|Producto|$)/);
      const productoMatch = bodyText.match(/Producto:\s*([^\n\r]*?)(?=\s{2,}|Flag|$)/);
      const colorMatch = bodyText.match(/Color DxP:\s*([^\n\r]*?)(?=\s{2,}|Motivo|$)/);

      return {
        nombres,
        documento,
        ultimaActualizacion,
        montoTotal,
        semActualClass,
        semPrevioClass,
        score: scoreMatch ? scoreMatch[1].trim() : '',
        motivoCaida: motivoMatch ? motivoMatch[1].trim() : '',
        filtroVehicular: filtroMatch ? filtroMatch[1].trim() : '',
        producto: productoMatch ? productoMatch[1].trim() : '',
        colorDxP: colorMatch ? colorMatch[1].trim() : '',
      };
    });

    // ═══════════════════════════════════════════════════════
    // FASE 2: Tab "Información General" (ya visible por defecto)
    // ═══════════════════════════════════════════════════════
    // La tab ya está activa al cargar, extraemos directamente
    const infoGeneral = await page.evaluate(() => {
      const knownLabels = ['Nombres', 'Documento', 'Nacimiento', 'Sexo', 'Estado Civil', 'RUC', 'Razón Social', 'Giro', 'Estado', 'Tipo', 'Condición', 'Independientes'];

      function getFieldByLabel(label: string): string {
        const tds = Array.from(document.querySelectorAll('td'));
        for (let i = 0; i < tds.length; i++) {
          const text = tds[i].textContent?.trim();
          if (text === label && tds[i + 1]) {
            const val = tds[i + 1].textContent?.trim() || '';
            // Si el valor es otra label conocida, el campo está vacío
            if (!val || knownLabels.includes(val)) return '';
            return val;
          }
        }
        return '';
      }

      return {
        datos: {
          nombres: getFieldByLabel('Nombres'),
          documento: getFieldByLabel('Documento'),
          nacimiento: getFieldByLabel('Nacimiento'),
          sexo: getFieldByLabel('Sexo'),
          estadoCivil: getFieldByLabel('Estado Civil'),
        },
        ruc: {
          ruc: getFieldByLabel('RUC'),
          razonSocial: getFieldByLabel('Razón Social'),
          giro: getFieldByLabel('Giro'),
          estado: getFieldByLabel('Estado'),
          tipo: getFieldByLabel('Tipo'),
          condicion: getFieldByLabel('Condición'),
        }
      };
    });

    // ═══════════════════════════════════════════════════════
    // FASE 3: Tab "Histórico"
    // ═══════════════════════════════════════════════════════
    await clickTab(page, 'Histórico');
    const historico: HistoricoEntry[] = await page.evaluate(() => {
      const results: any[] = [];
      const tables = document.querySelectorAll('table');
      for (const table of tables) {
        const ths = Array.from(table.querySelectorAll('th')).map(th => th.textContent?.trim() || '');
        if (ths.some(h => h.includes('Deuda Total') || h.includes('N. Enti'))) {
          // Estructura real de la tabla (multi-row header con colspan):
          // TD[0]=Fecha, TD[1]=Mes, TD[2]=Sem.Act.(icono, vacío),
          // TD[3]=N.Enti, TD[4]=DeudaTotal, TD[5]=%NOR,
          // TD[6]=%CPP, TD[7]=%DEF, TD[8]=%DUD, TD[9]=%PER
          const rows = table.querySelectorAll('tbody tr');
          for (const row of rows) {
            const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent?.trim() || '');
            if (cells.length >= 8) {
              results.push({
                fecha: cells[0] || '',
                mes: cells[1] || '',
                numEntidades: cells[3] || '',   // Skip cells[2] (semáforo icon)
                deudaTotal: cells[4] || '',
                porNOR: cells[5] || '',
                porCPP: cells[6] || '',
                porDEF: cells[7] || '',
                porDUD: cells[8] || '',
                porPER: cells[9] || '',
              });
            }
          }
          break;
        }
      }
      return results;
    });

    // ═══════════════════════════════════════════════════════
    // FASE 4: Tab "Deudas"
    // ═══════════════════════════════════════════════════════
    await clickTab(page, 'Deudas');
    const deudas = await page.evaluate(() => {
      const lineas: any[] = [];
      const detalle: any[] = [];
      const tables = document.querySelectorAll('table');

      for (const table of tables) {
        const ths = Array.from(table.querySelectorAll('th')).map(th => th.textContent?.trim() || '');

        // Tabla de líneas de crédito
        if (ths.some(h => h.includes('Linea Aprobada') || h.includes('Línea Aprobada'))) {
          const rows = table.querySelectorAll('tbody tr');
          for (const row of rows) {
            const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent?.trim() || '');
            if (cells.length >= 4) {
              lineas.push({
                entidad: cells[0] || '',
                lineaAprobada: cells[1] || '',
                lineaNoUtilizada: cells[2] || '',
                lineaUtilizada: cells[3] || '',
              });
            }
          }
        }

        // Tabla de detalle de deuda
        if (ths.some(h => h.includes('Nombre de la Entidad')) && ths.some(h => h.includes('Monto'))) {
          const rows = table.querySelectorAll('tbody tr');
          for (const row of rows) {
            const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent?.trim() || '');
            if (cells.length >= 2) {
              const campos: Record<string, string> = {};
              for (let i = 1; i < cells.length && i < ths.length; i++) {
                if (ths[i] && cells[i]) {
                  campos[ths[i]] = cells[i];
                }
              }
              detalle.push({
                entidad: cells[0] || '',
                campos,
              });
            }
          }
        }
      }

      return { lineas, detalle };
    });

    // ═══════════════════════════════════════════════════════
    // FASE 5: Tab "Otros"
    // ═══════════════════════════════════════════════════════
    await clickTab(page, 'Otros');
    const otros: Record<string, string>[] = await page.evaluate(() => {
      const results: any[] = [];
      const tables = document.querySelectorAll('table');
      for (const table of tables) {
        const ths = Array.from(table.querySelectorAll('th')).map(th => th.textContent?.trim() || '');
        // Solo capturar la tabla "Resumen Financiero" (Entidad, Prestamo, TC, etc.)
        const isResumenFinanciero = ths.some(h => h.includes('Préstamo') || h.includes('Prestamo'))
          && ths.some(h => h.includes('Entidad'));
        if (isResumenFinanciero && ths.length > 0) {
          const rows = table.querySelectorAll('tbody tr');
          for (const row of rows) {
            const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent?.trim() || '');
            if (cells.length > 0) {
              const entry: Record<string, string> = {};
              for (let i = 0; i < cells.length && i < ths.length; i++) {
                if (ths[i]) entry[ths[i]] = cells[i] || '';
              }
              results.push(entry);
            }
          }
          break; // Solo una tabla
        }
      }
      return results;
    });

    // ═══════════════════════════════════════════════════════
    // Construir resultado final
    // ═══════════════════════════════════════════════════════
    const result: RCCResult = {
      dni,
      nombres: cabecera.nombres || infoGeneral.datos.nombres || 'No encontrado',
      semaforo: detectarSemaforo(cabecera.semActualClass),
      semaforoPrevio: detectarSemaforo(cabecera.semPrevioClass),
      deudaTotal: cabecera.montoTotal,
      ultimaActualizacion: cabecera.ultimaActualizacion,
      documento: cabecera.documento,
      flagNoContactar,
      motivoCaida: cabecera.motivoCaida,
      score: cabecera.score,
      filtroVehicular: cabecera.filtroVehicular,
      producto: cabecera.producto,
      colorDxP: cabecera.colorDxP,
      infoGeneral: infoGeneral.datos,
      ruc: infoGeneral.ruc,
      historico,
      lineasCredito: deudas.lineas,
      detalleDeuda: deudas.detalle,
      otros,
    };

    cache.set(dni, { data: result, timestamp: Date.now() });

    console.log(`[INFOBURO] ✓ Consulta completa DNI: ${dni} → ${result.nombres} | S/${result.deudaTotal} | Semáforo: ${result.semaforo} | ${result.historico.length} registros históricos`);
    return result;

  } catch (error) {
    console.error(`[INFOBURO] ✗ Error consultando DNI ${dni}:`, error);
    throw new Error(`No se pudo completar la consulta para DNI: ${dni}`);
  }
}

// ── Cerrar sesión ──────────────────────────────────────────
export async function cerrarSesionInfoburo(): Promise<void> {
  if (persistentBrowser) {
    try { await persistentBrowser.close(); } catch {}
    persistentBrowser = null;
    persistentPage = null;
    sessionActive = false;
    console.log('[INFOBURO] Sesión cerrada');
  }
}
