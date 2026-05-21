import axios from 'axios';
import qs from 'qs';

type DniProviderRecord = Record<string, any>;

const firstText = (record: DniProviderRecord, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return undefined;
};

const calcularEdad = (fechaNacimiento?: string) => {
  if (!fechaNacimiento) {
    return undefined;
  }

  const [anio, mes, dia] = fechaNacimiento.split('-').map(Number);
  if (!anio || !mes || !dia) {
    return undefined;
  }

  const birthDate = new Date(anio, mes - 1, dia);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const normalizeSexo = (sexo?: string) => {
  if (!sexo) return undefined;
  if (sexo === '1' || /^m/i.test(sexo)) return 'Masculino';
  if (sexo === '2' || /^f/i.test(sexo)) return 'Femenino';
  return sexo;
};

const compactObject = <T extends Record<string, any>>(value: T) => (
  Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== '')
  ) as Partial<T>
);

export async function getDniInfo(dni: string) {
  try {
    const data = qs.stringify({
      'action': 'consulta_dni_api',
      'tipo': 'dni',
      'dni': dni,
      'pagina': '1'
    });

    const config = {
      method: 'post',
      url: 'https://buscardniperu.com/wp-admin/admin-ajax.php',
      timeout: 15000,
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      data : data
    };

    const response = await axios.request(config);
    const json = response.data;
    
    if (!json || !json.success || !json.data) {
      throw new Error('DNI no encontrado o error en el proveedor.');
    }

    const rd: DniProviderRecord = json.data;
    if (rd.detail || !rd.dni) {
      throw new Error(String(rd.detail || 'DNI no encontrado.'));
    }

    const fechaNacimiento = firstText(rd, ['fecha_nac', 'fecha_nacimiento', 'fch_nacimiento']);
    const edadNum = calcularEdad(fechaNacimiento);
    const digitoRuc = firstText(rd, ['dig_ruc', 'digito_ruc']);
    const digitoVerificador = firstText(rd, ['dig_verifica', 'digito_verificador', 'digito_verificacion', 'cod_verifica']);
    const nombres = firstText(rd, ['nombres']);
    const apellidoPaterno = firstText(rd, ['ap_pat', 'apellido_paterno']);
    const apellidoMaterno = firstText(rd, ['ap_mat', 'apellido_materno']);
    const normalizedDni = firstText(rd, ['dni']) || dni;

    const datosAdicionales = compactObject({
      ruc10: digitoRuc ? `10${normalizedDni}${digitoRuc}` : undefined,
      digito_ruc: digitoRuc,
      digito_verificador: digitoVerificador,
      fecha_emision: firstText(rd, ['fch_emision', 'fecha_emision', 'fecha_exp', 'fecha_expedicion']),
      fecha_inscripcion: firstText(rd, ['fch_inscripcion', 'fecha_inscripcion']),
      ubigeo_nacimiento: firstText(rd, ['ubigeo_nac', 'ubigeo_nacimiento']),
      ubigeo_direccion: firstText(rd, ['ubigeo_dir', 'ubigeo_direccion']),
      departamento: firstText(rd, ['departamento', 'depa_dir', 'departamento_dir']),
      provincia: firstText(rd, ['provincia', 'prov_dir', 'provincia_dir']),
      distrito: firstText(rd, ['distrito', 'dist_dir', 'distrito_dir']),
      grado_instruccion: firstText(rd, ['grado_inst', 'grado_instruccion']),
      estatura: firstText(rd, ['estatura']),
      restricciones: firstText(rd, ['restriccion', 'restricciones'])
    });

    return compactObject({
      dni: normalizedDni,
      nombres,
      apellido_paterno: apellidoPaterno,
      apellido_materno: apellidoMaterno,
      nombre_completo: [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(' '),
      fecha_nacimiento: fechaNacimiento,
      edad: edadNum !== undefined ? `${edadNum} años` : undefined,
      edad_num: edadNum,
      estado_civil: firstText(rd, ['est_civil', 'estado_civil']),
      direccion: firstText(rd, ['direccion']),
      ubigeo: firstText(rd, ['ubigeo_dir', 'ubigeo_direccion']),
      sexo: normalizeSexo(firstText(rd, ['sexo'])),
      padre: firstText(rd, ['padre']),
      madre: firstText(rd, ['madre']),
      fecha_caducidad: firstText(rd, ['fch_caducidad', 'fecha_caducidad']),
      ruc10: datosAdicionales.ruc10,
      digito_ruc: datosAdicionales.digito_ruc,
      digito_verificador: datosAdicionales.digito_verificador,
      fecha_emision: datosAdicionales.fecha_emision,
      fecha_inscripcion: datosAdicionales.fecha_inscripcion,
      ubigeo_nacimiento: datosAdicionales.ubigeo_nacimiento,
      departamento: datosAdicionales.departamento,
      provincia: datosAdicionales.provincia,
      distrito: datosAdicionales.distrito,
      grado_instruccion: datosAdicionales.grado_instruccion,
      estatura: datosAdicionales.estatura,
      restricciones: datosAdicionales.restricciones,
      datos_adicionales: Object.keys(datosAdicionales).length > 0 ? datosAdicionales : undefined
    });
  } catch (error: any) {
    console.error('[DNI SERVICE ERROR]', error.message);
    if (/DNI no encontrado|No se encontró/i.test(error.message || '')) {
      throw new Error(error.message);
    }
    throw new Error('La fuente de DNI no responde. Intenta de nuevo en unos minutos.');
  }
}
