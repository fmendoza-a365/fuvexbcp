#!/bin/bash
# Script de diagnóstico para la API de SBI

LOG_FILE="/opt/fuvex/storage/logs/sbi-diagnostico.log"

echo "=== DIAGNOSTICO TECNICO SBI ===" > "$LOG_FILE"
echo "Fecha y hora: $(date)" >> "$LOG_FILE"
echo "-----------------------------------" >> "$LOG_FILE"

echo -e "\n1. IP PUBLICA DE LA DROPLET:" >> "$LOG_FILE"
curl -4 -s --connect-timeout 10 ifconfig.me >> "$LOG_FILE" 2>&1
echo -e "\n" >> "$LOG_FILE"

echo -e "\n2. PRUEBAS DNS (nslookup):" >> "$LOG_FILE"
for domain in api-sbi.work sbi-app.com api-sbi.com.mx; do
  echo "--- $domain ---" >> "$LOG_FILE"
  nslookup "$domain" >> "$LOG_FILE" 2>&1
done

echo -e "\n3. VALIDACION CONEXION HTTPS (curl -I):" >> "$LOG_FILE"
for domain in api-sbi.work sbi-app.com api-sbi.com.mx; do
  echo "--- https://$domain ---" >> "$LOG_FILE"
  curl -I -s --connect-timeout 10 "https://$domain" >> "$LOG_FILE" 2>&1
done

echo -e "\n4. CONEXION BASICA AL ENDPOINT /datos:" >> "$LOG_FILE"
curl -v -s --connect-timeout 10 "https://api-sbi.work/datos" >> "$LOG_FILE" 2>&1

echo -e "\n5. ESTADO DEL FIREWALL (ufw):" >> "$LOG_FILE"
ufw status verbose >> "$LOG_FILE" 2>&1

echo -e "\n6. PRUEBAS DESDE EL CONTENEDOR BACKEND (fuvex_app_prod):" >> "$LOG_FILE"
if docker ps | grep -q fuvex_app_prod; then
  echo "--- IP Pública del Contenedor ---" >> "$LOG_FILE"
  docker exec fuvex_app_prod curl -4 -s --connect-timeout 10 ifconfig.me >> "$LOG_FILE" 2>&1
  echo -e "\n--- DNS inside container ---" >> "$LOG_FILE"
  docker exec fuvex_app_prod nslookup api-sbi.work >> "$LOG_FILE" 2>&1
  echo -e "\n--- Connection check inside container ---" >> "$LOG_FILE"
  docker exec fuvex_app_prod curl -I -s --connect-timeout 10 "https://api-sbi.work" >> "$LOG_FILE" 2>&1
else
  echo "Contenedor fuvex_app_prod no encontrado o inactivo." >> "$LOG_FILE"
fi

echo -e "\n=== FIN DEL DIAGNOSTICO ===" >> "$LOG_FILE"
