import axios from 'axios';
import qs from 'qs';

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

    const rd = json.data;
    let edad = 'Desconocida';
    
    if (rd.fecha_nac) {
      // fecha_nac is format "1992-10-02"
      const [anio, mes, dia] = rd.fecha_nac.split('-').map(Number);
      const birthDate = new Date(anio, mes - 1, dia);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      edad = `${age} años`;
    }

    return {
      dni: rd.dni,
      nombres: rd.nombres,
      apellido_paterno: rd.ap_pat,
      apellido_materno: rd.ap_mat,
      nombre_completo: `${rd.nombres} ${rd.ap_pat} ${rd.ap_mat}`,
      fecha_nacimiento: rd.fecha_nac,
      edad: edad,
      edad_num: parseInt(edad), // Utility for math operations
      estado_civil: rd.est_civil,
      direccion: rd.direccion,
      ubigeo: rd.ubigeo_dir,
      sexo: rd.sexo === "1" ? "Masculino" : "Femenino",
      padre: rd.padre,
      madre: rd.madre,
      fecha_caducidad: rd.fch_caducidad
    };
  } catch (error: any) {
    console.error('[DNI SERVICE ERROR]', error.message);
    throw new Error('La fuente de DNI no responde. Intenta de nuevo en unos minutos.');
  }
}
