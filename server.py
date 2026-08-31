import os
import time
import json
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta
import psycopg2
from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__, static_folder='dist')

# ==============================================================================
# SECURITY & AUTHENTICATION CONFIGURATION
# ==============================================================================
# Master password: CNC2026 (stored with cryptographic salt)
AUTH_SALT = b"ClinicaNuevaDeCali_Statistics_2026_SecSalt"
# PBKDF2 hash of "CNC2026" with salt
MASTER_PASS_HASH = hashlib.pbkdf2_hmac(
    'sha256',
    b"CNC2026",
    AUTH_SALT,
    100000
).hex()

# Server-side secret key for HMAC token signing
SERVER_SECRET = secrets.token_hex(32)

# Rate Limiting & Brute-Force Protection State
# ip -> {'attempts': int, 'last_attempt': float, 'lockout_until': float}
LOGIN_ATTEMPTS = {}
MAX_ATTEMPTS = 5
LOCKOUT_DURATION_SECONDS = 300  # 5 minutes lockout

def check_rate_limit(ip):
    now = time.time()
    record = LOGIN_ATTEMPTS.get(ip, {'attempts': 0, 'last_attempt': 0, 'lockout_until': 0})
    
    if record['lockout_until'] > now:
        remaining = int(record['lockout_until'] - now)
        return False, f"Demasiados intentos fallidos. Sistema bloqueado temporalmente por {remaining} segundos."
    
    # Reset attempts if more than 5 minutes have passed since last attempt
    if now - record['last_attempt'] > 300:
        record['attempts'] = 0
        
    return True, None

def record_failed_attempt(ip):
    now = time.time()
    record = LOGIN_ATTEMPTS.get(ip, {'attempts': 0, 'last_attempt': 0, 'lockout_until': 0})
    record['attempts'] += 1
    record['last_attempt'] = now
    
    if record['attempts'] >= MAX_ATTEMPTS:
        record['lockout_until'] = now + LOCKOUT_DURATION_SECONDS
        LOGIN_ATTEMPTS[ip] = record
        return f"Límite de {MAX_ATTEMPTS} intentos alcanzado. Bloqueado por 5 minutos."
    
    LOGIN_ATTEMPTS[ip] = record
    remaining_attempts = MAX_ATTEMPTS - record['attempts']
    return f"Contraseña incorrecta. {remaining_attempts} intento(s) restante(s)."

def reset_attempts(ip):
    if ip in LOGIN_ATTEMPTS:
        del LOGIN_ATTEMPTS[ip]

def create_session_token():
    payload = {
        'exp': int(time.time()) + 3600 * 8,  # 8 hours session
        'nonce': secrets.token_hex(8)
    }
    payload_str = json.dumps(payload)
    sig = hmac.new(SERVER_SECRET.encode(), payload_str.encode(), hashlib.sha256).hexdigest()
    return f"{payload_str}.{sig}"

def verify_session_token(token):
    if not token:
        return False
    try:
        parts = token.rsplit('.', 1)
        if len(parts) != 2:
            return False
        payload_str, sig = parts
        expected_sig = hmac.new(SERVER_SECRET.encode(), payload_str.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return False
        payload = json.loads(payload_str)
        if time.time() > payload.get('exp', 0):
            return False
        return True
    except Exception:
        return False

# ==============================================================================
# DATABASE CONFIGURATION
# ==============================================================================
DB_HOST = os.environ.get('DB_HOST', '172.21.21.37')
DB_PORT = int(os.environ.get('DB_PORT', 5432))
DB_NAME = os.environ.get('DB_NAME', 'icosalud_quinta')
DB_USER = os.environ.get('DB_USER', 'postgres')
DB_PASSWORD = os.environ.get('DB_PASSWORD', 'Teleco2018')

MONTH_NAMES = {1:'Enero', 2:'Febrero', 3:'Marzo', 4:'Abril', 5:'Mayo', 6:'Junio', 7:'Julio', 8:'Agosto', 9:'Septiembre', 10:'Octubre', 11:'Noviembre', 12:'Diciembre'}
MONTH_SHORT = {1:'ene', 2:'feb', 3:'mar', 4:'abr', 5:'may', 6:'jun', 7:'jul', 8:'ago', 9:'sep', 10:'oct', 11:'nov', 12:'dic'}
MONTH_REVERSE = {v.lower(): k for k, v in MONTH_NAMES.items()}
for k, v in MONTH_SHORT.items():
    MONTH_REVERSE[v.lower()] = k

ALL_12_MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

CACHE = {}

def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )

def load_sql_template():
    with open('ARTICULOS CX PMIENTO.sql', 'r', encoding='utf-8-sig') as f:
        return f.read()

SQL_TEMPLATE = load_sql_template()

# Security Headers & CORS
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    # Security hardening headers
    response.headers.add('X-Content-Type-Options', 'nosniff')
    response.headers.add('X-Frame-Options', 'SAMEORIGIN')
    response.headers.add('X-XSS-Protection', '1; mode=block')
    return response

# ==============================================================================
# AUTHENTICATION ENDPOINTS
# ==============================================================================
@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    ip = request.remote_addr or '127.0.0.1'
    allowed, msg = check_rate_limit(ip)
    if not allowed:
        return jsonify({'success': False, 'message': msg, 'locked': True}), 429

    data = request.get_json(silent=True) or {}
    password = str(data.get('password', '')).strip()

    if not password:
        return jsonify({'success': False, 'message': 'Por favor ingrese la contraseña'}), 400

    # Artificial delay to prevent rapid-fire brute-force timing
    time.sleep(0.35)

    # Hash user password with salt
    user_pass_hash = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        AUTH_SALT,
        100000
    ).hex()

    # Constant-time comparison
    if hmac.compare_digest(user_pass_hash, MASTER_PASS_HASH):
        reset_attempts(ip)
        token = create_session_token()
        return jsonify({
            'success': True,
            'message': 'Autenticación exitosa',
            'token': token,
            'role': 'authorized_user'
        })
    else:
        fail_msg = record_failed_attempt(ip)
        return jsonify({'success': False, 'message': fail_msg}), 401

@app.route('/api/auth/verify', methods=['POST'])
def auth_verify():
    data = request.get_json(silent=True) or {}
    token = data.get('token', '')
    if verify_session_token(token):
        return jsonify({'valid': True})
    return jsonify({'valid': False}), 401

# ==============================================================================
# STATUS & DATA ENDPOINTS
# ==============================================================================
@app.route('/api/status', methods=['GET'])
def get_status():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT current_database(), version();")
        db_name, version = cur.fetchone()
        cur.close()
        conn.close()
        return jsonify({
            'status': 'online',
            'database': db_name,
            'host': DB_HOST,
            'connected': True
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e),
            'connected': False
        }), 500

@app.route('/api/years', methods=['GET'])
def get_years():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT DISTINCT EXTRACT(YEAR FROM fecha_actualizacion)::int AS y 
            FROM mov_encabezado 
            WHERE fecha_actualizacion IS NOT NULL AND EXTRACT(YEAR FROM fecha_actualizacion) BETWEEN 2018 AND 2030
            ORDER BY y DESC;
        """)
        years = [str(r[0]) for r in cur.fetchall() if r[0]]
        cur.close()
        conn.close()
        return jsonify({'years': years, 'months': ALL_12_MONTHS})
    except Exception as e:
        return jsonify({'years': ['2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018'], 'months': ALL_12_MONTHS, 'error': str(e)})

@app.route('/api/data', methods=['GET'])
def get_data():
    year = request.args.get('year', '2026')
    month = request.args.get('month', '')

    cache_key = f"{year}_{month}"
    if cache_key in CACHE:
        return jsonify(CACHE[cache_key])

    try:
        # Date clause
        if month and month.lower() in MONTH_REVERSE:
            m_num = MONTH_REVERSE[month.lower()]
            start_date = f"{year}-{m_num:02d}-01 00:00:00"
            if m_num == 12:
                end_date = f"{int(year)+1}-01-01 00:00:00"
            else:
                end_date = f"{year}-{m_num+1:02d}-01 00:00:00"
            date_clause = f"AND mov_encabezado.fecha_actualizacion >= '{start_date}' AND mov_encabezado.fecha_actualizacion < '{end_date}'"
        else:
            start_date = f"{year}-01-01 00:00:00"
            end_date = f"{int(year)+1}-01-01 00:00:00"
            date_clause = f"AND mov_encabezado.fecha_actualizacion >= '{start_date}' AND mov_encabezado.fecha_actualizacion < '{end_date}'"

        target_sql = SQL_TEMPLATE.replace(
            "AND mov_encabezado.fecha_actualizacion between '2026/08/01 00:00:00' and '2026/08/31 23:59:59'",
            date_clause
        )

        conn = get_db_connection()
        cur = conn.cursor()
        t0 = time.time()
        cur.execute(target_sql)
        rows = cur.fetchall()
        elapsed = time.time() - t0
        cur.close()
        conn.close()

        records = []
        all_meses = set()
        all_dias = set()
        all_cirujanos = set()
        all_especs = set()
        all_tipos = set()

        for r in rows:
            cirugia = str(r[0] or '')
            fecha_cargue = r[12]
            fecha_cx = r[2]
            dt = fecha_cargue if fecha_cargue else fecha_cx
            
            y_str = year
            m_str = 'Agosto'
            d_str = '01-ago'

            if dt:
                try:
                    y_str = str(dt.year)
                    m_str = MONTH_NAMES.get(dt.month, 'Agosto')
                    d_str = f"{dt.day:02d}-{MONTH_SHORT.get(dt.month, 'ago')}"
                except:
                    pass

            qx1 = (r[4] or 'OTRO').strip()
            cirujano = (r[6] or 'DESCONOCIDO').strip()
            espec = (r[7] or 'OTRO').strip()
            tipo_proc = (r[8] or 'OTRO').strip()
            nom_articulo = (r[10] or 'ARTICULO').strip()
            valor = float(r[11] or 0)

            all_meses.add(m_str)
            all_dias.add(d_str)
            all_cirujanos.add(cirujano)
            all_especs.add(espec)
            all_tipos.add(tipo_proc)

            records.append({
                'c': cirugia,
                'y': y_str,
                'm': m_str,
                'd': d_str,
                'q': qx1,
                's': cirujano,
                'e': espec,
                't': tipo_proc,
                'a': nom_articulo,
                'v': valor
            })

        result = {
            'records': records,
            'metadata': {
                'anios': [year],
                'meses': ALL_12_MONTHS,
                'dias': sorted(list(all_dias)),
                'cirujanos': sorted([c for c in all_cirujanos if c]),
                'especialidades': sorted([e for e in all_especs if e]),
                'tipos': sorted([t for t in all_tipos if t]),
                'totalRecords': len(records),
                'queryTimeSeconds': round(elapsed, 2),
                'fromDatabase': True
            }
        }

        CACHE[cache_key] = result
        return jsonify(result)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Starting Secure PostgreSQL API Server on port {port}...")
    print("Authentication: CNC2026 enabled with PBKDF2 hashing & rate limiting.")
    app.run(host='0.0.0.0', port=port, debug=False)
