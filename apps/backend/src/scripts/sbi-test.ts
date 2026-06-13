import * as dotenv from 'dotenv';
import dns from 'dns/promises';
import { SbiApiService, getDropletPublicIp, writeSbiLog } from '../services/sbi';

dotenv.config();

function maskKey(key: string | undefined): string {
  if (!key) return 'NO CONFIGURADO';
  if (key.length <= 8) return '***';
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}

async function runDiagnostic() {
  console.log('=== SBI CLI DIAGNOSTIC ===');
  const logMessages: string[] = [];

  const addLog = (msg: string) => {
    console.log(msg);
    logMessages.push(msg);
  };

  addLog(`Fecha: ${new Date().toISOString()}`);

  // 1. Env vars
  const baseUrl = process.env.SBI_API_BASE_URL || 'https://api-sbi.work';
  const user = process.env.SBI_API_USER || '';
  const key = process.env.SBI_API_KEY || '';
  const authMode = process.env.SBI_AUTH_MODE || 'header_bearer';

  addLog('\n--- CONFIGURACION DE ENTORNO ---');
  addLog(`SBI_API_BASE_URL: ${baseUrl}`);
  addLog(`SBI_API_USER: ${user || 'NO CONFIGURADO'}`);
  addLog(`SBI_API_KEY: ${maskKey(key)}`);
  addLog(`SBI_AUTH_MODE: ${authMode}`);

  // 2. IP Pública
  addLog('\n--- IP PUBLICA DE SALIDA ---');
  try {
    const publicIp = await getDropletPublicIp();
    addLog(`IP: ${publicIp}`);
  } catch (err: any) {
    addLog(`Error detectando IP pública: ${err.message}`);
  }

  // 3. DNS lookups
  addLog('\n--- RESOLUCION DNS ---');
  const domains = ['api-sbi.work', 'sbi-app.com', 'api-sbi.com.mx'];
  for (const domain of domains) {
    try {
      const addresses = await dns.resolve4(domain);
      addLog(`${domain} -> IP(s): ${addresses.join(', ')}`);
    } catch (err: any) {
      addLog(`Error resolviendo ${domain}: ${err.message}`);
    }
  }

  // 4. API connection test
  addLog('\n--- PRUEBA DE CONEXION API /datos ---');
  try {
    const result = await SbiApiService.testConnection(null);
    addLog(`Status Code: ${result.status_code}`);
    addLog(`Success: ${result.success}`);
    addLog(`Message: ${result.message}`);
    addLog(`Duración: ${result.duration_ms}ms`);
    if (result.error_id) {
      addLog(`Error ID: ${result.error_id}`);
    }
    if (result.raw_response) {
      addLog(`Response Summary: ${JSON.stringify(result.raw_response).substring(0, 200)}...`);
    }
  } catch (err: any) {
    addLog(`Error ejecutando llamada de prueba: ${err.message}`);
  }

  // Save trace in logs file
  const fullLog = logMessages.join('\n');
  writeSbiLog(`=== DIAGNOSTICO CLI ===\n${fullLog}\n=== FIN DIAGNOSTICO CLI ===`);
  console.log('\nResultados del diagnóstico agregados a storage/logs/sbi.log');
}

runDiagnostic().catch((err) => {
  console.error('Diagnostic error:', err);
  process.exit(1);
});
