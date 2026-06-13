import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const prisma = new PrismaClient();

export interface SbiResponse {
  success: boolean;
  status_code: number;
  error_id: number | null;
  message: string;
  data: any;
  raw_response: any;
  duration_ms: number;
}

// Simple local log writer
export function writeSbiLog(content: string) {
  try {
    const logDir = path.resolve(process.cwd(), 'storage/logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logPath = path.join(logDir, 'sbi.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${content}\n`);
  } catch (err) {
    console.error('Error writing to sbi.log:', err);
  }
}

// Outgoing IP cache
let cachedPublicIp: string | null = null;
let lastIpCheck = 0;

export async function getDropletPublicIp(): Promise<string> {
  const now = Date.now();
  if (cachedPublicIp && (now - lastIpCheck) < 5 * 60 * 1000) {
    return cachedPublicIp;
  }
  
  // Try api.ipify.org (returns clean plain-text IP)
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://api.ipify.org', { signal: controller.signal });
    clearTimeout(id);
    if (res.ok) {
      const ip = (await res.text()).trim();
      if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip)) {
        cachedPublicIp = ip;
        lastIpCheck = now;
        return cachedPublicIp;
      }
    }
  } catch (e) {
    // Ignore and fallback
  }

  // Fallback to ipinfo.io/ip
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://ipinfo.io/ip', { signal: controller.signal });
    clearTimeout(id);
    if (res.ok) {
      const ip = (await res.text()).trim();
      if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip)) {
        cachedPublicIp = ip;
        lastIpCheck = now;
        return cachedPublicIp;
      }
    }
  } catch (e) {
    // Ignore
  }

  return cachedPublicIp || '134.209.64.146';
}

// Normalizer
export function extractNormalizedData(item: any): any {
  if (!item || typeof item !== 'object') return null;
  const norm: Record<string, any> = {};

  // Dossier structure from docs
  if (item.generales) {
    const g = item.generales;
    norm.dni = g.documento || g.dni || '';
    norm.nombre = g.nombres || `${g.paterno || ''} ${g.materno || ''} ${g.nombres || ''}`.trim();
    norm.fecha = g.nacimiento || '';
    norm.estado = g.estado_civil || '';
  }
  
  if (item.ruc) {
    norm.ruc = item.ruc.ruc || '';
    if (!norm.nombre) norm.nombre = item.ruc.razon_social || '';
  }

  // Flat key structure check
  const keys = Object.keys(item);
  for (const k of keys) {
    const val = item[k];
    if (val === undefined || val === null) continue;
    const kl = k.toLowerCase();
    
    if (kl === 'id' || kl === 'uuid' || kl === 'sbi_id') {
      if (!norm.id) norm.id = String(val);
    } else if (kl === 'dni' || kl === 'documento' || kl === 'nro_documento') {
      if (!norm.dni) norm.dni = String(val);
    } else if (kl === 'ruc' || kl === 'nro_ruc') {
      if (!norm.ruc) norm.ruc = String(val);
    } else if (kl === 'nombre' || kl === 'nombres' || kl === 'nombre_completo' || kl === 'razon_social') {
      if (!norm.nombre) norm.nombre = String(val);
    } else if (kl === 'telefono' || kl === 'telefonos' || kl === 'phone') {
      if (!norm.telefono) norm.telefono = String(val);
    } else if (kl === 'celular' || kl === 'celulares' || kl === 'mobile') {
      if (!norm.celular) norm.celular = String(val);
    } else if (kl === 'correo' || kl === 'email' || kl === 'email_address') {
      if (!norm.correo) norm.correo = String(val);
    } else if (kl === 'direccion' || kl === 'address') {
      if (!norm.direccion) norm.direccion = String(val);
    } else if (kl === 'estado' || kl === 'status') {
      if (!norm.estado) norm.estado = String(val);
    } else if (kl === 'fecha' || kl === 'date' || kl === 'created_at') {
      if (!norm.fecha) norm.fecha = String(val);
    }
  }

  return norm;
}

export class SbiApiService {
  /**
   * Main client for requests to the SBI API
   */
  static async request(
    userId: string | null,
    endpoint: string,
    params: Record<string, any>
  ): Promise<SbiResponse> {
    const start = Date.now();
    const publicIp = await getDropletPublicIp();

    // Load configs from env
    const baseUrl = (process.env.SBI_API_BASE_URL || 'https://api-sbi.work').replace(/\/$/, '');
    const user = process.env.SBI_API_USER || '';
    const key = process.env.SBI_API_KEY || '';
    const timeoutSeconds = parseInt(process.env.SBI_TIMEOUT_SECONDS || '30', 10);
    const authMode = process.env.SBI_AUTH_MODE || 'header_bearer';

    const url = `${baseUrl}${endpoint}`;
    let method = 'GET';
    let headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    let queryParams = new URLSearchParams();
    let bodyData: any = null;

    // Apply credentials depending on authMode
    switch (authMode) {
      case 'header_bearer':
        headers['Authorization'] = `Bearer ${key}`;
        break;
      case 'header_x_api_key':
        headers['x-api-key'] = key;
        break;
      case 'body_user_key':
        method = 'POST';
        headers['Content-Type'] = 'application/json';
        bodyData = {
          usuario: user,
          key: key,
          ...params
        };
        break;
      case 'query_user_key':
      default:
        queryParams.append('key', key);
        if (user) {
          queryParams.append('usuario', user);
        }
        break;
    }

    // Set parameters in request
    if (method === 'GET') {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) {
          queryParams.append(k, String(v));
        }
      }
    } else if (method === 'POST' && authMode !== 'body_user_key') {
      headers['Content-Type'] = 'application/json';
      bodyData = params;
    }

    const requestUrl = queryParams.toString() ? `${url}?${queryParams.toString()}` : url;

    // Hide real API key for header logging
    const maskedHeaders = { ...headers };
    if (maskedHeaders['Authorization']) {
      maskedHeaders['Authorization'] = 'Bearer ***MASKED***';
    }
    if (maskedHeaders['x-api-key']) {
      maskedHeaders['x-api-key'] = '***MASKED***';
    }

    let statusCode = 0;
    let rawResponse: any = null;
    let sbiSuccess = false;
    let errorId: number | null = null;
    let errorMessage: string | null = null;

    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutSeconds * 1000);

      const fetchOptions: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };

      if (bodyData) {
        fetchOptions.body = JSON.stringify(bodyData);
      }

      const res = await fetch(requestUrl, fetchOptions);
      clearTimeout(id);

      statusCode = res.status;
      const responseText = await res.text();

      try {
        rawResponse = JSON.parse(responseText);
      } catch {
        rawResponse = { raw: responseText };
        throw new Error('La respuesta del servidor SBI no es un JSON válido');
      }

      if (statusCode === 200) {
        // Successful response structure can be: { status: "ok", data: {...} } or direct array
        if (rawResponse.status === 'error' || rawResponse.success === false) {
          sbiSuccess = false;
          errorId = rawResponse.error_id || rawResponse.errorCode || null;
          errorMessage = rawResponse.message || rawResponse.error || 'Respuesta fallida declarada por la API';
        } else {
          sbiSuccess = true;
        }
      } else if (statusCode === 401 || statusCode === 403) {
        sbiSuccess = false;
        errorId = rawResponse.error_id || 202; // Default 202 if unauthorized
        errorMessage = rawResponse.message || rawResponse.error || 'Usuario no autorizado';
      } else {
        sbiSuccess = false;
        errorId = rawResponse.error_id || statusCode;
        errorMessage = rawResponse.message || rawResponse.error || `Error del servidor HTTP ${statusCode}`;
      }
    } catch (err: any) {
      sbiSuccess = false;
      errorMessage = err.message || String(err);
      if (err.name === 'AbortError') {
        statusCode = 408;
        errorMessage = `Request timeout after ${timeoutSeconds}s`;
      }
    }

    const duration = Date.now() - start;

    // Specific error 202 override
    if (errorId === 202 || (errorMessage && errorMessage.toLowerCase().includes('autorizado'))) {
      errorId = 202;
      errorMessage = 'Usuario no autorizado';
    }

    // Save in Database
    let sbiRequestRecord: any = null;
    try {
      // Create request log
      sbiRequestRecord = await prisma.sbiApiRequest.create({
        data: {
          user_id: userId,
          endpoint,
          method,
          base_url: baseUrl,
          auth_mode: authMode,
          request_params: JSON.stringify(params),
          request_headers: JSON.stringify(maskedHeaders),
          status_code: statusCode,
          success: sbiSuccess,
          error_id: errorId,
          error_message: errorMessage,
          response_summary: rawResponse ? JSON.stringify({
            status: rawResponse.status || null,
            dataKeys: rawResponse.data ? Object.keys(rawResponse.data) : null,
            hasData: !!rawResponse.data
          }) : null,
          duration_ms: duration,
          server_public_ip: publicIp
        }
      });

      // Save results
      if (sbiSuccess && rawResponse) {
        const payloadData = rawResponse.data || rawResponse.results || rawResponse.datos || rawResponse;

        if (Array.isArray(payloadData)) {
          // Array of objects
          for (const item of payloadData) {
            await prisma.sbiApiResult.create({
              data: {
                sbi_api_request_id: sbiRequestRecord.id,
                external_id: item.id || item.documento || null,
                payload: JSON.stringify(item),
                normalized_data: JSON.stringify(extractNormalizedData(item))
              }
            });
          }
        } else {
          // Single dossier/object
          await prisma.sbiApiResult.create({
            data: {
              sbi_api_request_id: sbiRequestRecord.id,
              external_id: payloadData.generales?.documento || payloadData.documento || null,
              payload: JSON.stringify(payloadData),
              normalized_data: JSON.stringify(extractNormalizedData(payloadData))
            }
          });
        }
      }
    } catch (dbErr) {
      logger.error('SBI', 'Error guardando registros SBI en Base de Datos', dbErr);
    }

    // Log to file
    const logSummary = `Endpoint: ${endpoint} | Status: ${statusCode} | Success: ${sbiSuccess} | Duration: ${duration}ms | IP: ${publicIp}${errorId ? ` | Error: ${errorId} - ${errorMessage}` : ''}`;
    writeSbiLog(logSummary);

    return {
      success: sbiSuccess,
      status_code: statusCode,
      error_id: errorId,
      message: sbiSuccess ? 'Consulta exitosa' : (errorMessage || 'Error desconocido'),
      data: sbiSuccess ? (rawResponse.data || rawResponse.results || rawResponse.datos || rawResponse) : null,
      raw_response: rawResponse || {},
      duration_ms: duration
    };
  }

  /**
   * Performs /datos query
   */
  static async queryDatos(
    userId: string | null,
    documento: string,
    meses: number,
    planilla?: number
  ): Promise<SbiResponse> {
    return this.request(userId, '/datos', {
      documento,
      meses,
      ...(planilla !== undefined ? { planilla } : {})
    });
  }

  /**
   * Tests the connection
   */
  static async testConnection(userId: string | null): Promise<SbiResponse> {
    // We send a dummy query to /datos to see if we reach the server
    return this.request(userId, '/datos', {
      documento: '99999999',
      meses: 1
    });
  }
}
