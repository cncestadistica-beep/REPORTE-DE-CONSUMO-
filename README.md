# Sistema de Monitoreo y Reporte de Consumo de Insumos CX & Procedimientos Menores
### Clínica Nueva de Cali · Dirección de Estadística & Cirugía (2026)

Dashboard interactivo institucional para el análisis, control y exportación multi-hoja en Excel (.xlsx) de insumos y procedimientos quirúrgicos.

---

## 🚀 Características Principales

- 📊 **Portal de Acceso Seguro**: Autenticación criptográfica con PBKDF2, sal criptográfica, rate limiting anti fuerza bruta y token firmado con HMAC-SHA256 (Clave: `CNC2026`).
- 📈 **KPIs Dinámicos & Variación MoM**: Métricas de consumo anual, promedio mensual, mes de mayor valor con variación vs mes anterior, acumulado del mes, promedio diario y día de mayor valor (resaltado en morado con línea de promedio protegida).
- 📉 **Gráfico Pareto x Especialidad**: Análisis de regla 80/20 interactivo 100% responsivo con punto de corte destacado.
- 📋 **Tablas Dinámicas con Degradado 80/20**: Tablas de *Cirujano*, *CUPS* y *Artículo* con cálculo de cantidad, total y degradado de color verde hasta el 80% (blanco > 80%).
- 📑 **Exportador Excel (.xlsx)**: Generador nativo multi-hoja con selector interactivo de meses y días independientes.
- 🔄 **Integración PostgreSQL / Flask**: API REST con consultas optimizadas y fallback a dataset local.

---

## 🛠️ Requisitos de Ejecución

- **Python 3.10+** (con `flask`, `flask-cors`, `psycopg2-binary`, `python-dotenv`)
- **Node.js 18+** (para desarrollo con Vite)

---

## ▶️ Instrucciones de Inicio Rápido

1. **Iniciar Servidor Completo**:
   Ejecutar el archivo `iniciar_dashboard.bat` o:
   ```bash
   python server.py
   ```
   Abrir en el navegador: `http://localhost:5000`

2. **Iniciar Entorno de Desarrollo (Vite)**:
   Ejecutar `iniciar_desarrollo_vite.bat` o:
   ```bash
   npm run dev
   ```

---
*powered by statistics CNC 2026*
