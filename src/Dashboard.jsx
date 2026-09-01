import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  Calendar,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Download,
  FileSpreadsheet,
  Layers,
  Loader2,
  LogOut,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Stethoscope,
  TrendingUp,
  User,
  X
} from 'lucide-react';
// Data is loaded 100% dynamically from PostgreSQL database via API

const ALL_12_MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const HISTORICAL_YEARS = ['2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018'];

// Currency formatters
const moneyShort = n => {
  if (n === 0 || !n) return '$0.000m';
  if (Math.abs(n) >= 1e6) {
    return `$${(n / 1e6).toFixed(3)}m`;
  }
  return `$${Math.round(n).toLocaleString('es-CO')}`;
};

const moneyFull = n => `$${Math.round(n || 0).toLocaleString('es-CO')}`;

const percentFmt = n => `${((n || 0) * 100).toFixed(1).replace('.', ',')}%`;

// Custom Dot for Pareto Line - ONLY THE EXACT 80% CUTOFF POINT IS RED
const CustomParetoDot = (props) => {
  const { cx, cy, payload, index, cutoff80Index } = props;
  if (cx === undefined || cy === undefined || !payload) return null;
  const isCutoff80 = index === cutoff80Index;

  if (isCutoff80) {
    return (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r={7}
          fill="none"
          stroke="#c0392b"
          strokeWidth={1.5}
          strokeDasharray="2 2"
          opacity={0.95}
        />
        <circle
          cx={cx}
          cy={cy}
          r={4.5}
          fill="#c0392b"
          stroke="#ffffff"
          strokeWidth={1.5}
        />
      </g>
    );
  }

  return (
    <circle
      cx={cx}
      cy={cy}
      r={3}
      fill="#ed7d31"
      stroke="#ffffff"
      strokeWidth={1}
    />
  );
};

// Custom Label on Pareto points - ONLY THE EXACT 80% CUTOFF POINT IS RED
const CustomParetoLabel = (props) => {
  const { x, y, value, index, cutoff80Index } = props;
  if (x === undefined || y === undefined || value === undefined) return null;
  const numVal = Math.round(Number(value));
  const isCutoff80 = index === cutoff80Index;

  if (isCutoff80) {
    return (
      <g transform={`translate(${x}, ${y - 12})`}>
        <rect
          x={-13}
          y={-15}
          width={26}
          height={14}
          fill="#fce8e6"
          stroke="#c0392b"
          strokeWidth={1.2}
          rx={2.5}
        />
        <text
          x={0}
          y={-5}
          textAnchor="middle"
          fill="#900c3f"
          fontSize={9}
          fontWeight={800}
        >
          {`${numVal}%`}
        </text>
      </g>
    );
  }

  return (
    <g transform={`translate(${x}, ${y - 12})`}>
      <rect
        x={-10}
        y={-14}
        width={20}
        height={13}
        fill="#eaf0f2"
        stroke="#b2c0c7"
        strokeWidth={0.5}
        rx={2}
      />
      <text
        x={0}
        y={-4.5}
        textAnchor="middle"
        fill="#22313a"
        fontSize={8}
        fontWeight={700}
      >
        {`${numVal}%`}
      </text>
    </g>
  );
};

// Custom Promedio Badge on Reference Line so it's always clearly readable and never covered by bars
const renderPromedioLabel = (props) => {
  const { viewBox, value } = props;
  if (!viewBox) return null;
  const { x, y, width } = viewBox;
  return (
    <g transform={`translate(${x + (width ? width * 0.45 : 120)}, ${y - 11})`}>
      <rect
        x={-8}
        y={-11}
        width={142}
        height={18}
        fill="#ffffff"
        stroke="#e11d48"
        strokeWidth={1.5}
        rx={4}
        filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.15))"
      />
      <text
        x={63}
        y={1.5}
        textAnchor="middle"
        fill="#be123c"
        fontSize={10.5}
        fontWeight={800}
      >
        {value || 'Promedio'}
      </text>
    </g>
  );
};

// Custom Monthly Horizontal Bar Label
const renderMonthlyBarLabel = (props, dataList) => {
  const { x, y, width, height, value, index } = props;
  if (x === undefined || y === undefined || width === undefined) return null;

  const item = (dataList && dataList[index]) ? dataList[index] : null;
  const varPct = item ? item.var_pct : 0;
  const isPositive = varPct > 0;

  let displayVar = 'Variación: 0%';
  if (index > 0 && item && varPct !== 0) {
    displayVar = `Variación: ${isPositive ? '+' : ''}${varPct.toFixed(1)}%`;
  } else if (index === 0) {
    displayVar = 'Variación: 0%';
  }

  const cy = y + height / 2;
  const midX = x + width / 2;
  const displayVal = item ? item.value : value;

  return (
    <g key={`monthly-lbl-${index}`}>
      {width > 45 && (
        <text
          x={midX}
          y={cy + 4.5}
          fill="#ffffff"
          fontSize={11.5}
          fontWeight={800}
          textAnchor="middle"
        >
          {displayVar}
        </text>
      )}
      <text
        x={x + width + 8}
        y={cy + 4.5}
        fill="#37138c"
        fontSize={11.5}
        fontWeight={800}
        textAnchor="start"
      >
        {moneyShort(displayVal)}
      </text>
    </g>
  );
};

// Dropdown Select Filter Component
function DropdownFilter({ label, icon: Icon, value, options, placeholder, onChange, disabled = false }) {
  return (
    <div className="dropdown-group">
      <label className="dropdown-label">
        <Icon size={12} />
        <span>{label}</span>
      </label>
      <div className="dropdown-select-wrapper">
        <select
          className={`dropdown-select ${value ? 'is-active' : ''}`}
          value={value || ''}
          disabled={disabled}
          onChange={e => onChange(e.target.value ? e.target.value : null)}
        >
          <option value="">{placeholder || `(Todos: ${label})`}</option>
          {options.map(opt => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="dropdown-icon" />
      </div>
    </div>
  );
}

// Pivot Table Component matching Excel Sheet RPORT
function ExcelPivotTable({ title, columns, data, searchField = 0, initialLimit = 12 }) {
  const [filterText, setFilterText] = useState('');
  const [showAll, setShowAll] = useState(false);

  const filteredData = useMemo(() => {
    if (!filterText) return data;
    return data.filter(row =>
      String(row[searchField]).toLowerCase().includes(filterText.toLowerCase())
    );
  }, [data, filterText, searchField]);

  const displayData = showAll ? filteredData : filteredData.slice(0, initialLimit);

  const moneyColIdx = columns.length === 4 ? 2 : 1;
  const grandTotal = useMemo(() => {
    return data.reduce((sum, row) => sum + (Number(row[moneyColIdx]) || 0), 0);
  }, [data, moneyColIdx]);

  const totalQty = useMemo(() => {
    if (columns.length === 4) {
      return data.reduce((sum, row) => sum + (Number(row[1]) || 0), 0);
    }
    return 0;
  }, [data, columns.length]);

  return (
    <section className="excel-table-card">
      <div className="table-card-header">
        <h3>{title}</h3>
        <input
          type="text"
          className="table-search-input"
          placeholder="Filtrar fila..."
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
        />
      </div>

      <div className="table-scroll-container">
        <table className="excel-pivot-table">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th key={col} className={idx > 0 ? 'text-right' : ''}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayData.map((row, rIdx) => (
              <tr key={rIdx}>
                {row.map((cell, cIdx) => {
                  const isParetoCol = cIdx === row.length - 1 && typeof cell === 'number' && cell <= 1.01;

                  let rendered = cell;
                  if (isParetoCol) {
                    rendered = percentFmt(cell);
                  } else if (columns.length === 4 && cIdx === 1) {
                    rendered = Number(cell || 0).toLocaleString('es-CO');
                  } else if (columns.length === 4 && cIdx === 2) {
                    rendered = moneyFull(cell);
                  } else if (columns.length === 3 && cIdx === 1) {
                    rendered = moneyFull(cell);
                  }

                  let paretoStyle = {};
                  if (isParetoCol) {
                    const num = typeof cell === 'number' ? cell : 0;
                    if (num <= 0.80001) {
                      const ratio = Math.min(Math.max(num / 0.80, 0), 1);
                      const alpha = (0.32 - (0.26 * ratio)).toFixed(3);
                      paretoStyle = {
                        backgroundColor: `rgba(16, 185, 129, ${alpha})`,
                        color: '#047857',
                        fontWeight: 700
                      };
                    } else {
                      paretoStyle = {
                        color: '#64748b',
                        fontWeight: 500
                      };
                    }
                  }

                  return (
                    <td
                      key={cIdx}
                      title={String(cell)}
                      style={isParetoCol ? paretoStyle : {}}
                      className={`${cIdx > 0 ? 'text-right' : ''}`}
                    >
                      {rendered}
                    </td>
                  );
                })}
              </tr>
            ))}
            {displayData.length === 0 && (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                  No hay datos para la selección actual
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td>Total general</td>
              {columns.length === 4 ? (
                <>
                  <td className="text-right">
                    {totalQty.toLocaleString('es-CO')}
                  </td>
                  <td className="text-right">{moneyFull(grandTotal)}</td>
                  <td className="text-right">100,0%</td>
                </>
              ) : (
                <>
                  <td className="text-right">{moneyFull(grandTotal)}</td>
                  <td className="text-right">100,0%</td>
                </>
              )}
            </tr>
          </tfoot>
        </table>
      </div>

      {filteredData.length > initialLimit && (
        <div style={{ padding: '6px 12px', background: '#fafbfc', borderTop: '1px solid #edf1f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
          <span>Mostrando {displayData.length} de {filteredData.length} registros</span>
          <button
            style={{ border: 'none', background: 'none', color: '#009999', fontWeight: 700, cursor: 'pointer' }}
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'Ver menos' : 'Ver todos'}
          </button>
        </div>
      )}
    </section>
  );
}

export default function Dashboard({ onLogout }) {
  const [currentDataset, setCurrentDataset] = useState({
    records: [],
    metadata: {
      anios: ['2026'],
      meses: ALL_12_MONTHS,
      dias: [],
      cirujanos: [],
      especialidades: [],
      tipos: [],
      totalRecords: 0,
      fromDatabase: true
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [availableYears, setAvailableYears] = useState(HISTORICAL_YEARS);

  // Filter States (Desplegables)
  const [selectedAnio, setSelectedAnio] = useState('2026');
  const [selectedMes, setSelectedMes] = useState(null);
  const [selectedTipo, setSelectedTipo] = useState(null);
  const [selectedDia, setSelectedDia] = useState(null);
  const [selectedEspec, setSelectedEspec] = useState(null);
  const [selectedCirujano, setSelectedCirujano] = useState(null);

  // Export Modal States
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportSelectedMonths, setExportSelectedMonths] = useState(ALL_12_MONTHS);
  const [exportSelectedDays, setExportSelectedDays] = useState(
    Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'))
  );

  // Fetch years and initial 2026 data dynamically from PostgreSQL on load
  useEffect(() => {
    fetch('/api/years')
      .then(r => r.json())
      .then(yData => {
        if (yData.years && yData.years.length > 0) {
          setAvailableYears(yData.years);
        }
      })
      .catch(() => {});

    // Initial fetch of current year from PostgreSQL
    fetchDataFromDB(selectedAnio || '2026', null);
  }, []);

  const fetchDataFromDB = async (year, month) => {
    if (!year) return;
    setIsLoading(true);
    try {
      const token = sessionStorage.getItem('auth_token') || '';
      const url = `/api/data?year=${year}${month ? `&month=${encodeURIComponent(month)}` : ''}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.records && data.records.length > 0) {
          setCurrentDataset(data);
        }
      }
    } catch (err) {
      console.warn('Could not fetch from database backend, keeping current dataset.', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleYearChange = (newYear) => {
    setSelectedAnio(newYear);
    setSelectedDia(null);
    if (newYear) {
      fetchDataFromDB(newYear, selectedMes);
    }
  };

  const handleMonthChange = (newMonth) => {
    setSelectedMes(newMonth);
    setSelectedDia(null);
  };

  const resetFilters = () => {
    setSelectedAnio('2026');
    setSelectedMes(null);
    setSelectedTipo(null);
    setSelectedDia(null);
    setSelectedEspec(null);
    setSelectedCirujano(null);
  };

  const { records, metadata } = currentDataset;

  // Available days
  const availableDias = useMemo(() => {
    const diasInSelection = new Set();
    records.forEach(r => {
      if (selectedAnio && r.y !== selectedAnio) return;
      if (selectedMes && r.m !== selectedMes) return;
      diasInSelection.add(r.d);
    });
    return Array.from(diasInSelection).sort((a, b) => a.localeCompare(b));
  }, [records, selectedAnio, selectedMes]);

  const availableEspecialidades = useMemo(() => {
    if (metadata.especialidades && metadata.especialidades.length > 0) {
      return metadata.especialidades;
    }
    const set = new Set();
    records.forEach(r => { if (r.e) set.add(r.e); });
    return Array.from(set).sort();
  }, [records, metadata.especialidades]);

  const availableCirujanos = useMemo(() => {
    if (metadata.cirujanos && metadata.cirujanos.length > 0) {
      return metadata.cirujanos;
    }
    const set = new Set();
    records.forEach(r => { if (r.s) set.add(r.s); });
    return Array.from(set).sort();
  }, [records, metadata.cirujanos]);

  // Year Dataset
  const yearFilteredRecords = useMemo(() => {
    return records.filter(r => {
      if (selectedAnio && r.y !== selectedAnio) return false;
      if (selectedTipo && r.t !== selectedTipo) return false;
      if (selectedEspec && r.e !== selectedEspec) return false;
      if (selectedCirujano && r.s !== selectedCirujano) return false;
      return true;
    });
  }, [records, selectedAnio, selectedTipo, selectedEspec, selectedCirujano]);

  // Monthly breakdown and MoM variation calculation
  const monthlyVariationData = useMemo(() => {
    const map = {};
    yearFilteredRecords.forEach(r => {
      map[r.m] = (map[r.m] || 0) + r.v;
    });

    const activeMonths = ALL_12_MONTHS.filter(m => map[m] !== undefined && map[m] > 0);
    let prevVal = null;

    return activeMonths.map((m, idx) => {
      const val = map[m] || 0;
      let varPct = 0;
      let varStr = 'Variación: 0%';

      if (prevVal !== null && prevVal > 0) {
        varPct = ((val - prevVal) / prevVal) * 100;
        varStr = `Variación: ${varPct > 0 ? '+' : ''}${varPct.toFixed(1)}%`;
      } else {
        varStr = 'Variación: 0%';
      }

      prevVal = val;

      return {
        month: m.toUpperCase(),
        monthRaw: m,
        value: val,
        var_pct: varPct,
        var_str: varStr,
        isSelected: selectedMes === m
      };
    });
  }, [yearFilteredRecords, selectedMes]);

  const maxMonthlyVal = useMemo(() => {
    const maxVal = Math.max(...monthlyVariationData.map(m => m.value), 100000000);
    return maxVal * 1.25;
  }, [monthlyVariationData]);

  // KPIs
  const acumuladoDelAnio = useMemo(() => {
    return yearFilteredRecords.reduce((sum, r) => sum + r.v, 0);
  }, [yearFilteredRecords]);

  const monthlyYearStats = useMemo(() => {
    const map = {};
    yearFilteredRecords.forEach(r => {
      map[r.m] = (map[r.m] || 0) + r.v;
    });
    return map;
  }, [yearFilteredRecords]);

  const promedioMes = useMemo(() => {
    const activeMonths = Object.keys(monthlyYearStats).length || 1;
    return acumuladoDelAnio / activeMonths;
  }, [acumuladoDelAnio, monthlyYearStats]);

  const topMonth = useMemo(() => {
    let maxVal = -1;
    let monthName = '-';
    Object.entries(monthlyYearStats).forEach(([m, val]) => {
      if (val > maxVal) {
        maxVal = val;
        monthName = m;
      }
    });
    return { name: monthName, value: maxVal > 0 ? maxVal : 0 };
  }, [monthlyYearStats]);

  const topMonthVarInfo = useMemo(() => {
    if (!topMonth.name || topMonth.name === '-') return { str: '-' };
    const idx = ALL_12_MONTHS.indexOf(topMonth.name);
    if (idx > 0) {
      const prevName = ALL_12_MONTHS[idx - 1];
      const prevVal = monthlyYearStats[prevName] || 0;
      if (prevVal > 0) {
        const pct = ((topMonth.value - prevVal) / prevVal) * 100;
        return {
          pct,
          prevName,
          str: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs ${prevName}`
        };
      }
    }
    return { str: 'Mes inicial' };
  }, [topMonth, monthlyYearStats]);

  const filteredRecords = useMemo(() => {
    return yearFilteredRecords.filter(r => {
      if (selectedMes && r.m !== selectedMes) return false;
      if (selectedDia && r.d !== selectedDia) return false;
      return true;
    });
  }, [yearFilteredRecords, selectedMes, selectedDia]);

  const totalAcumulado = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + r.v, 0);
  }, [filteredRecords]);

  const tipoMetrics = useMemo(() => {
    const tipos = ['CIRUGIA', 'OTRO', 'OBSTETRICIA', 'PROCEDIMIENTOS MENORES'];
    const res = {};
    tipos.forEach(t => {
      res[t] = { valor: 0, count: 0, surgeries: new Set() };
    });

    filteredRecords.forEach(r => {
      const t = r.t || 'OTRO';
      if (!res[t]) res[t] = { valor: 0, count: 0, surgeries: new Set() };
      res[t].valor += r.v;
      res[t].surgeries.add(r.c);
      res[t].count += 1;
    });

    return res;
  }, [filteredRecords]);

  const dailyData = useMemo(() => {
    if (selectedMes) {
      const daysInMonth = Array.from(new Set(yearFilteredRecords.filter(r => r.m === selectedMes).map(r => r.d))).sort();
      const dayMap = {};
      daysInMonth.forEach(d => {
        dayMap[d] = { date: d, value: 0, count: 0 };
      });
      filteredRecords.forEach(r => {
        if (dayMap[r.d]) {
          dayMap[r.d].value += r.v;
          dayMap[r.d].count += 1;
        }
      });
      return daysInMonth.map(d => dayMap[d]);
    }

    const dayNumbers = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
    const dayMap = {};
    dayNumbers.forEach(dNum => {
      dayMap[dNum] = { date: `Día ${dNum}`, value: 0, count: 0 };
    });

    filteredRecords.forEach(r => {
      const dNum = (r.d || '').substring(0, 2);
      if (dayMap[dNum]) {
        dayMap[dNum].value += r.v;
        dayMap[dNum].count += 1;
      }
    });

    return dayNumbers.map(dNum => dayMap[dNum]);
  }, [filteredRecords, yearFilteredRecords, selectedMes]);

  const topDay = useMemo(() => {
    let maxVal = -1;
    let day = '-';
    dailyData.forEach(d => {
      if (d.value > maxVal) {
        maxVal = d.value;
        day = d.date;
      }
    });
    return { day, value: maxVal > 0 ? maxVal : 0 };
  }, [dailyData]);

  const maxDailyValue = useMemo(() => {
    return Math.max(...dailyData.map(d => d.value), 0);
  }, [dailyData]);

  const dailyAverage = useMemo(() => {
    const activeDays = dailyData.filter(d => d.value > 0).length || dailyData.length || 31;
    return totalAcumulado / activeDays;
  }, [totalAcumulado, dailyData]);

  // Pareto by Especialidad for Chart
  const paretoEspecialidades = useMemo(() => {
    const map = {};
    filteredRecords.forEach(r => {
      const e = r.e || '(en blanco)';
      map[e] = (map[e] || 0) + r.v;
    });

    const sorted = Object.entries(map)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

    const grandTotal = sorted.reduce((sum, item) => sum + item.total, 0) || 1;
    let cum = 0;

    return sorted.map(item => {
      cum += item.total;
      return {
        ...item,
        cumulative: (cum / grandTotal) * 100
      };
    });
  }, [filteredRecords]);

  const cutoff80Index = useMemo(() => {
    return paretoEspecialidades.findIndex(p => p.cumulative >= 80);
  }, [paretoEspecialidades]);

  const maxParetoVal = useMemo(() => {
    const maxVal = Math.max(...paretoEspecialidades.map(p => p.total), 300000000);
    return Math.ceil(maxVal / 50000000) * 50000000;
  }, [paretoEspecialidades]);

  // Pivot Table 1: Por Cirujano
  const tableCirujanos = useMemo(() => {
    const map = {};
    filteredRecords.forEach(r => {
      const s = r.s || 'DESCONOCIDO';
      map[s] = (map[s] || 0) + r.v;
    });

    const sorted = Object.entries(map)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

    const grand = sorted.reduce((sum, item) => sum + item.total, 0) || 1;
    let cum = 0;

    return sorted.map(item => {
      cum += item.total;
      return [item.name, item.total, cum / grand];
    });
  }, [filteredRecords]);

  // Pivot Table 2: Por CUPS
  const tableCups = useMemo(() => {
    const map = {};
    filteredRecords.forEach(r => {
      const q = r.q || 'OTRO';
      if (!map[q]) map[q] = { total: 0, surgeries: new Set() };
      map[q].total += r.v;
      map[q].surgeries.add(r.c);
    });

    const sorted = Object.entries(map)
      .map(([name, data]) => ({ name, total: data.total, qty: data.surgeries.size }))
      .sort((a, b) => b.total - a.total);

    const grand = sorted.reduce((sum, item) => sum + item.total, 0) || 1;
    let cum = 0;

    return sorted.map(item => {
      cum += item.total;
      return [item.name, item.qty, item.total, cum / grand];
    });
  }, [filteredRecords]);

  // Pivot Table 3: Por Artículo
  const tableArticulos = useMemo(() => {
    const map = {};
    filteredRecords.forEach(r => {
      const a = r.a || 'ARTICULO';
      if (!map[a]) map[a] = { total: 0, count: 0 };
      map[a].total += r.v;
      map[a].count += 1;
    });

    const sorted = Object.entries(map)
      .map(([name, data]) => ({ name, total: data.total, qty: data.count }))
      .sort((a, b) => b.total - a.total);

    const grand = sorted.reduce((sum, item) => sum + item.total, 0) || 1;
    let cum = 0;

    return sorted.map(item => {
      cum += item.total;
      return [item.name, item.qty, item.total, cum / grand];
    });
  }, [filteredRecords]);

  const exportMatchedRecords = useMemo(() => {
    return records.filter(r => {
      if (selectedAnio && r.y !== selectedAnio) return false;
      if (selectedTipo && r.t !== selectedTipo) return false;
      if (selectedEspec && r.e !== selectedEspec) return false;
      if (selectedCirujano && r.s !== selectedCirujano) return false;

      if (exportSelectedMonths.length > 0 && !exportSelectedMonths.includes(r.m)) return false;

      const dNum = (r.d || '').substring(0, 2);
      if (exportSelectedDays.length > 0 && !exportSelectedDays.includes(dNum)) return false;

      return true;
    });
  }, [records, selectedAnio, selectedTipo, selectedEspec, selectedCirujano, exportSelectedMonths, exportSelectedDays]);

  const handleExecuteExcelExport = () => {
    const wb = XLSX.utils.book_new();

    const detailHeaders = ['Cirugia', 'Año', 'Mes', 'Dia', 'CUPS', 'Cirujano', 'Especialidad', 'Tipo_Procedimiento', 'Articulo', 'Valor'];
    const detailRows = exportMatchedRecords.map(r => [
      r.c, r.y, r.m, r.d, r.q, r.s, r.e, r.t, r.a, r.v
    ]);
    const wsDetail = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Detalle Insumos CX');

    const cirujanoMap = {};
    exportMatchedRecords.forEach(r => {
      const s = r.s || 'DESCONOCIDO';
      cirujanoMap[s] = (cirujanoMap[s] || 0) + r.v;
    });
    const cirujanosSorted = Object.entries(cirujanoMap).sort((a, b) => b[1] - a[1]);
    const totalCir = cirujanosSorted.reduce((sum, item) => sum + item[1], 0) || 1;
    let cumCir = 0;
    const cirujanoHeaders = ['Cirujano', 'Total Valor', '80/20 Acumulado'];
    const cirujanoRows = cirujanosSorted.map(([name, val]) => {
      cumCir += val;
      return [name, val, `${((cumCir / totalCir) * 100).toFixed(1)}%`];
    });
    const wsCirujanos = XLSX.utils.aoa_to_sheet([cirujanoHeaders, ...cirujanoRows]);
    XLSX.utils.book_append_sheet(wb, wsCirujanos, 'Por Cirujano');

    const cupsMap = {};
    exportMatchedRecords.forEach(r => {
      const q = r.q || 'OTRO';
      if (!cupsMap[q]) cupsMap[q] = { total: 0, surgeries: new Set() };
      cupsMap[q].total += r.v;
      cupsMap[q].surgeries.add(r.c);
    });
    const cupsSorted = Object.entries(cupsMap).sort((a, b) => b[1].total - a[1].total);
    const totalCups = cupsSorted.reduce((sum, item) => sum + item[1].total, 0) || 1;
    let cumCups = 0;
    const cupsHeaders = ['CUPS', 'Cantidad Procedimientos', 'Total Valor', '80/20 Acumulado'];
    const cupsRows = cupsSorted.map(([name, d]) => {
      cumCups += d.total;
      return [name, d.surgeries.size, d.total, `${((cumCups / totalCups) * 100).toFixed(1)}%`];
    });
    const wsCups = XLSX.utils.aoa_to_sheet([cupsHeaders, ...cupsRows]);
    XLSX.utils.book_append_sheet(wb, wsCups, 'Por CUPS');

    const artMap = {};
    exportMatchedRecords.forEach(r => {
      const a = r.a || 'ARTICULO';
      if (!artMap[a]) artMap[a] = { total: 0, count: 0 };
      artMap[a].total += r.v;
      artMap[a].count += 1;
    });
    const artSorted = Object.entries(artMap).sort((a, b) => b[1] - a[1]);
    const totalArt = artSorted.reduce((sum, item) => sum + item[1], 0) || 1;
    let cumArt = 0;
    const articulosHeaders = ['Artículo', 'Cantidad Insumos', 'Total Valor', '80/20 Acumulado'];
    const articulosRows = artSorted.map(([name, d]) => {
      cumArt += d.total;
      return [name, d.count, d.total, `${((cumArt / totalArt) * 100).toFixed(1)}%`];
    });
    const wsArticulos = XLSX.utils.aoa_to_sheet([articulosHeaders, ...articulosRows]);
    XLSX.utils.book_append_sheet(wb, wsArticulos, 'Por Articulo');

    const monthlyHeaders = ['Mes', 'Total Mensual', 'Variación MoM'];
    const monthlyRows = monthlyVariationData.map(m => [m.month, m.value, m.var_str]);
    const wsMonthly = XLSX.utils.aoa_to_sheet([monthlyHeaders, ...monthlyRows]);
    XLSX.utils.book_append_sheet(wb, wsMonthly, 'Total Mensual MoM');

    const monthTag = exportSelectedMonths.length === 12 ? 'Todos_Meses' : `${exportSelectedMonths.length}_Meses`;
    const filename = `Reporte_Consumo_Insumos_CX_${selectedAnio || '2026'}_${monthTag}.xlsx`;

    XLSX.writeFile(wb, filename);
    setIsExportModalOpen(false);
  };

  const toggleExportMonth = (m) => {
    setExportSelectedMonths(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    );
  };

  const toggleExportDay = (d) => {
    setExportSelectedDays(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    );
  };

  const activeFiltersCount = [selectedAnio !== '2026' ? selectedAnio : null, selectedMes, selectedTipo, selectedDia, selectedEspec, selectedCirujano].filter(Boolean).length;

  return (
    <div className="dashboard-container">
      {/* Top Banner Header Bar with clean glassmorphism */}
      <header className="excel-header">
        <div className="excel-header-left">
          <img
            src="/favicon.png"
            alt="Logo"
            className="excel-banner-logo"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <div className="excel-header-title">
            <h1>Reporte de Consumo Insumos CX &amp; Proc Menores.</h1>
          </div>
        </div>

        <div className="excel-header-right">
          {isLoading && (
            <div className="excel-btn" style={{ background: '#e0f2fe', borderColor: '#7dd3fc', color: '#0369a1' }}>
              <Loader2 size={14} className="spin-icon" />
              <span>Cargando datos...</span>
            </div>
          )}

          <button
            className="excel-btn excel-btn-excel"
            onClick={() => {
              if (selectedMes) setExportSelectedMonths([selectedMes]);
              else setExportSelectedMonths(ALL_12_MONTHS);
              if (selectedDia) setExportSelectedDays([selectedDia.substring(0, 2)]);
              else setExportSelectedDays(Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')));
              setIsExportModalOpen(true);
            }}
            title="Abrir selector de filtros y descargar reporte en Excel (.xlsx)"
          >
            <FileSpreadsheet size={15} />
            <span>Descargar Excel</span>
          </button>

          <button
            className="excel-btn-logout"
            onClick={onLogout}
            title="Cerrar sesión y volver al menú principal"
          >
            <LogOut size={14} />
            <span>Menú / Salir</span>
          </button>
        </div>
      </header>

            {/* Main Dashboard Content */}
      <main className="dashboard-main">
        {isLoading && currentDataset.records.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            background: 'rgba(255, 255, 255, 0.94)',
            borderRadius: '12px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
            margin: '20px auto',
            maxWidth: '600px',
            textAlign: 'center',
            color: '#007a7a'
          }}>
            <Loader2 size={40} className="spin-icon" color="#009999" style={{ marginBottom: '16px' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px', color: '#1e293b' }}>
              Consultando Base de Datos PostgreSQL...
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b' }}>
              Cargando registros activos de cirugías e insumos en tiempo real (icosalud_quinta).
            </p>
          </div>
        )}
        {/* 1. Dropdown Filters Bar with clean glassmorphism */}
        <section className="filters-bar-card">
          <div className="filters-bar-header">
            <div className="filters-bar-title">
              <SlidersHorizontal size={15} />
              <span>Filtros del Reporte (Desplegables)</span>
              {activeFiltersCount > 0 && (
                <span className="filters-active-count">{activeFiltersCount} activo{activeFiltersCount > 1 ? 's' : ''}</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {activeFiltersCount > 0 && (
                <button className="filter-clear-all-btn" onClick={resetFilters}>
                  <RotateCcw size={13} />
                  Limpiar Filtros
                </button>
              )}
              {selectedAnio && (
                <button
                  className="excel-btn"
                  title="Recargar datos de este año desde PostgreSQL"
                  onClick={() => fetchDataFromDB(selectedAnio, selectedMes)}
                  disabled={isLoading}
                >
                  <RefreshCw size={13} className={isLoading ? 'spin-icon' : ''} />
                  Recargar BD
                </button>
              )}
            </div>
          </div>

          <div className="filters-grid-dropdowns">
            <DropdownFilter
              label="Año"
              icon={Calendar}
              value={selectedAnio}
              options={availableYears}
              placeholder="Todos los años"
              onChange={handleYearChange}
            />

            <DropdownFilter
              label="Mes"
              icon={CalendarDays}
              value={selectedMes}
              options={ALL_12_MONTHS}
              placeholder="Todos los meses"
              onChange={handleMonthChange}
            />

            <DropdownFilter
              label="Tipo Procedimiento"
              icon={Layers}
              value={selectedTipo}
              options={metadata.tipos && metadata.tipos.length > 0 ? metadata.tipos : ['CIRUGIA', 'OTRO', 'OBSTETRICIA', 'PROCEDIMIENTOS MENORES']}
              placeholder="Todos los tipos"
              onChange={setSelectedTipo}
            />

            <DropdownFilter
              label="Fecha / Día"
              icon={Clock}
              value={selectedDia}
              options={availableDias}
              placeholder="Todos los días"
              onChange={setSelectedDia}
            />

            <DropdownFilter
              label="Especialidad"
              icon={Stethoscope}
              value={selectedEspec}
              options={availableEspecialidades}
              placeholder="Todas las especialidades"
              onChange={setSelectedEspec}
            />

            <DropdownFilter
              label="Cirujano"
              icon={User}
              value={selectedCirujano}
              options={availableCirujanos}
              placeholder="Todos los cirujanos"
              onChange={setSelectedCirujano}
            />
          </div>
        </section>

        {/* 2. KPI Cards Section */}
        <section className="kpis-section-wrapper">
          <div className="kpis-grid">
            {/* 1. AÑO */}
            <div className="excel-kpi-card hero-kpi">
              <span className="kpi-label">
                <span>1. AÑO</span>
                <span>{selectedAnio || '2026'}</span>
              </span>
              <strong className="kpi-main-val">{moneyFull(acumuladoDelAnio)}</strong>
              <div className="kpi-sub">
                <span>{yearFilteredRecords.length.toLocaleString('es-CO')} registros</span>
                <span>{new Set(yearFilteredRecords.map(r => r.c)).size.toLocaleString('es-CO')} cirugías</span>
              </div>
            </div>

            {/* 2. PROMEDIO MES */}
            <div className="excel-kpi-card">
              <span className="kpi-label">
                <span>2. PROMEDIO MES</span>
                <span>MENSUAL</span>
              </span>
              <strong className="kpi-main-val">{moneyShort(promedioMes)}</strong>
              <div className="kpi-sub">
                <span>Meses registrados:</span>
                <strong style={{ color: '#007a7a', fontSize: '12px' }}>{Object.keys(monthlyYearStats).length} meses</strong>
              </div>
            </div>

            {/* 3. MES DE MAYOR VALOR (Dinero arriba, Var abajo) */}
            <div className="excel-kpi-card">
              <span className="kpi-label">
                <span>3. MES DE MAYOR VALOR</span>
                <TrendingUp size={13} color="#009999" />
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '3px 0' }}>
                <strong className="kpi-main-val" style={{ color: '#009999', margin: 0 }}>{topMonth.name}</strong>
                <strong style={{ fontSize: '17px', fontWeight: 800, color: '#007a7a' }}>{moneyShort(topMonth.value)}</strong>
              </div>
              <div className="kpi-sub" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Var vs mes anterior:</span>
                {topMonthVarInfo.pct !== undefined && topMonth.name !== '-' ? (
                  <strong style={{ color: topMonthVarInfo.pct >= 0 ? '#16a34a' : '#dc2626', fontSize: '12px' }}>
                    {topMonthVarInfo.pct >= 0 ? '+' : ''}{topMonthVarInfo.pct.toFixed(1)}% vs {topMonthVarInfo.prevName || 'mes anterior'}
                  </strong>
                ) : (
                  <span>Mes inicial</span>
                )}
              </div>
            </div>

            {/* 4. TOTAL ACUMULADO MES */}
            <div className="excel-kpi-card accent-card">
              <span className="kpi-label">
                <span>4. TOTAL ACUMULADO MES</span>
                <span>{selectedMes || 'PERIODO'}</span>
              </span>
              <strong className="kpi-main-val" style={{ color: '#007a7a' }}>{moneyFull(totalAcumulado)}</strong>
              <div className="kpi-sub">
                <span>{filteredRecords.length.toLocaleString('es-CO')} registros</span>
                <span>{new Set(filteredRecords.map(r => r.c)).size.toLocaleString('es-CO')} cirugías</span>
              </div>
            </div>

            {/* 5. PROMEDIO DIARIO */}
            <div className="excel-kpi-card">
              <span className="kpi-label">
                <span>5. PROMEDIO DIARIO</span>
                <span>DIARIO</span>
              </span>
              <strong className="kpi-main-val">{moneyShort(dailyAverage)}</strong>
              <div className="kpi-sub">
                <span>Días activos:</span>
                <strong style={{ color: '#007a7a', fontSize: '12px' }}>{dailyData.length} días</strong>
              </div>
            </div>

            {/* 6. DÍA DE MAYOR VALOR */}
            <div className="excel-kpi-card">
              <span className="kpi-label">
                <span>6. DÍA DE MAYOR VALOR</span>
                <span>PICO</span>
              </span>
              <strong className="kpi-main-val" style={{ color: '#009999' }}>{topDay.day}</strong>
              <div className="kpi-sub">
                <span>Gasto pico del día:</span>
                <strong style={{ color: '#007a7a', fontSize: '12.5px' }}>{moneyShort(topDay.value)}</strong>
              </div>
            </div>
          </div>

          <div className="kpis-grid-proc">
            <div className="excel-kpi-card">
              <span className="kpi-label">CIRUGIA</span>
              <div className="kpi-split-box">
                <div className="kpi-split-item">
                  <p>Total Valor</p>
                  <strong>{moneyShort(tipoMetrics['CIRUGIA']?.valor || 0)}</strong>
                </div>
                <div className="kpi-split-item">
                  <p>Cantidad</p>
                  <strong>{(tipoMetrics['CIRUGIA']?.surgeries.size || 0).toLocaleString('es-CO')}</strong>
                </div>
              </div>
            </div>

            <div className="excel-kpi-card">
              <span className="kpi-label">OTRO</span>
              <div className="kpi-split-box">
                <div className="kpi-split-item">
                  <p>Total Valor</p>
                  <strong>{moneyShort(tipoMetrics['OTRO']?.valor || 0)}</strong>
                </div>
                <div className="kpi-split-item">
                  <p>Cantidad</p>
                  <strong>{(tipoMetrics['OTRO']?.surgeries.size || 0).toLocaleString('es-CO')}</strong>
                </div>
              </div>
            </div>

            <div className="excel-kpi-card">
              <span className="kpi-label">OBSTETRICIA</span>
              <div className="kpi-split-box">
                <div className="kpi-split-item">
                  <p>Total Valor</p>
                  <strong>{moneyShort(tipoMetrics['OBSTETRICIA']?.valor || 0)}</strong>
                </div>
                <div className="kpi-split-item">
                  <p>Cantidad</p>
                  <strong>{(tipoMetrics['OBSTETRICIA']?.surgeries.size || 0).toLocaleString('es-CO')}</strong>
                </div>
              </div>
            </div>

            <div className="excel-kpi-card">
              <span className="kpi-label">PROC. MENORES</span>
              <div className="kpi-split-box">
                <div className="kpi-split-item">
                  <p>Total Valor</p>
                  <strong>{moneyShort(tipoMetrics['PROCEDIMIENTOS MENORES']?.valor || 0)}</strong>
                </div>
                <div className="kpi-split-item">
                  <p>Cantidad</p>
                  <strong>{(tipoMetrics['PROCEDIMIENTOS MENORES']?.surgeries.size || 0).toLocaleString('es-CO')}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Double Charts Grid */}
        <section className="charts-double-grid">
          <div className="chart-card">
            <div className="chart-header">
              <h2>Total Mensual Insumos CX &amp; Variación MoM</h2>
              <div className="chart-legend">
                <div className="legend-item">
                  <span className="legend-square teal"></span>
                  <span>Total</span>
                </div>
                <div className="legend-item" style={{ color: '#37138c' }}>
                  <span style={{ fontWeight: 800 }}>Valores</span>
                </div>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={340}>
              <BarChart
                layout="vertical"
                data={monthlyVariationData}
                margin={{ top: 10, right: 95, left: 15, bottom: 10 }}
              >
                <CartesianGrid stroke="#eef2f4" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, maxMonthlyVal]}
                  tickFormatter={v => `$${(v / 1e6).toFixed(0)}m`}
                  tick={{ fontSize: 10, fill: '#60727c' }}
                  axisLine={{ stroke: '#ccd7dc' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#1b2832', fontWeight: 700 }}
                  axisLine={{ stroke: '#ccd7dc' }}
                  tickLine={false}
                  width={85}
                />
                <Tooltip
                  formatter={(val, name, item) => [
                    `${moneyFull(val)} (${item.payload.var_str})`,
                    'Total Mensual'
                  ]}
                  labelFormatter={(lbl) => `Mes: ${lbl}`}
                  contentStyle={{ borderRadius: 6, border: '1px solid #b2dfdb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }}
                />
                <Bar
                  dataKey="value"
                  fill="#139a8c"
                  radius={[0, 5, 5, 0]}
                  maxBarSize={28}
                  label={props => renderMonthlyBarLabel(props, monthlyVariationData)}
                >
                  {monthlyVariationData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isSelected ? '#007a7a' : '#139a8c'}
                      stroke={entry.isSelected ? '#004d4d' : 'none'}
                      strokeWidth={entry.isSelected ? 2 : 0}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleMonthChange(entry.monthRaw === selectedMes ? null : entry.monthRaw)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px 0', borderTop: '1px solid #edf2f4', fontSize: '11px', color: '#596b75' }}>
              <span>* En la mitad de la barra: <b>Variación MoM real vs mes anterior</b></span>
              <span>* Al final de la barra: <b>Total</b></span>
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <h2>Total Diario Insumos CX &amp; PROC MENORES</h2>
              <div className="chart-legend">
                <div className="legend-item">
                  <span className="legend-square teal"></span>
                  <span>Total Diario</span>
                </div>
                <div className="legend-item">
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#7c3aed' }}></span>
                  <span style={{ color: '#7c3aed', fontWeight: 700 }}>Día Pico</span>
                </div>
                <div className="legend-item">
                  <span style={{ display: 'inline-block', width: 12, height: 2, background: '#e11d48', borderTop: '2px dashed #e11d48' }}></span>
                  <span style={{ color: '#e11d48', fontWeight: 700 }}>Promedio</span>
                </div>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dailyData} margin={{ top: 15, right: 15, left: 0, bottom: 25 }}>
                <CartesianGrid stroke="#eef2f4" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9.5, fill: '#60727c' }}
                  interval={0}
                  angle={-55}
                  textAnchor="end"
                  height={50}
                  axisLine={{ stroke: '#ccd7dc' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={v => `$${(v / 1e6).toFixed(0)}m`}
                  tick={{ fontSize: 10, fill: '#60727c' }}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                />
                <Tooltip
                  formatter={(val) => [moneyFull(val), 'Total']}
                  labelFormatter={(lbl) => `Fecha: ${lbl}`}
                  contentStyle={{ borderRadius: 6, border: '1px solid #b2dfdb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }}
                />
                <Bar dataKey="value" radius={[2, 2, 0, 0]} maxBarSize={28}>
                  {dailyData.map((entry, index) => {
                    const isPeak = entry.value > 0 && entry.value === maxDailyValue;
                    return (
                      <Cell
                        key={`daily-cell-${index}`}
                        fill={isPeak ? '#7c3aed' : '#009999'}
                      />
                    );
                  })}
                </Bar>
                <ReferenceLine
                  y={dailyAverage}
                  stroke="#e11d48"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={props => renderPromedioLabel({ ...props, value: `Promedio: ${moneyShort(dailyAverage)}` })}
                />
              </BarChart>
            </ResponsiveContainer>

            <div className="daily-data-strip">
              {dailyData.map(item => (
                <div key={item.date}>
                  <b>{item.date}</b>
                  <span>{moneyShort(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. Full Width Pareto Chart */}
        <section className="pareto-fullwidth-section">
          <div className="chart-card pareto-chart-card">
            <div className="chart-header pareto-header-centered">
              <h2>Pareto x Especialidad.</h2>
              <div className="chart-legend pareto-legend-centered">
                <div className="legend-item">
                  <span className="legend-square teal"></span>
                  <span>TOTAL</span>
                </div>
                <div className="legend-item">
                  <span className="legend-line orange"></span>
                  <span>80/20 Acumulado</span>
                </div>
                <div className="legend-item">
                  <span className="legend-circle-red"></span>
                  <span>Punto de Corte 80%</span>
                </div>
              </div>
            </div>

            <div className="pareto-scroll-wrapper">
              <div className="pareto-inner-container">
                <ResponsiveContainer width="100%" height={380}>
                  <ComposedChart
                    data={paretoEspecialidades}
                    margin={{ top: 25, right: 25, left: 10, bottom: 95 }}
                  >
                    <CartesianGrid stroke="#eef2f4" vertical={false} />
                    <XAxis
                      dataKey="name"
                      angle={-65}
                      textAnchor="end"
                      interval={0}
                      height={100}
                      tick={{ fontSize: 8.5, fill: '#33414a', fontWeight: 600 }}
                      axisLine={{ stroke: '#009999', strokeWidth: 1.5 }}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="left"
                      domain={[0, maxParetoVal]}
                      tickFormatter={v => `$${(v / 1e6).toFixed(0)}m`}
                      tick={{ fontSize: 9.5, fill: '#4a5568' }}
                      axisLine={false}
                      tickLine={false}
                      width={65}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[0, 120]}
                      ticks={[0, 20, 40, 60, 80, 100, 120]}
                      tickFormatter={v => `${v}%`}
                      tick={{ fontSize: 9.5, fill: '#4a5568' }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                    />
                    <Tooltip
                      formatter={(v, name) => [
                        name === 'cumulative' ? `${Number(v).toFixed(1)}%` : moneyFull(v),
                        name === 'cumulative' ? '80/20 Acumulado' : 'Total'
                      ]}
                      contentStyle={{ borderRadius: 6, border: '1px solid #b2dfdb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }}
                    />
                    <ReferenceLine
                      yAxisId="right"
                      y={80}
                      stroke="#c0392b"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{ value: 'Límite 80%', position: 'right', fill: '#c0392b', fontSize: 10.5, fontWeight: 800 }}
                    />
                    <Bar yAxisId="left" dataKey="total" fill="#009999" radius={[1, 1, 0, 0]} maxBarSize={22} />
                    <Line
                      yAxisId="right"
                      type="linear"
                      dataKey="cumulative"
                      stroke="#ed7d31"
                      strokeWidth={2.2}
                      dot={props => <CustomParetoDot {...props} cutoff80Index={cutoff80Index} />}
                      activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }}
                      label={props => <CustomParetoLabel {...props} cutoff80Index={cutoff80Index} />}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Pivot Tables Grid */}
        <section className="tables-grid">
          <ExcelPivotTable
            title="Total acumulado por Cirujano"
            columns={['Cirujano', 'TOTAL', '80/20']}
            data={tableCirujanos}
            searchField={0}
            initialLimit={12}
          />

          <ExcelPivotTable
            title="Total Acumulado por CUPS"
            columns={['CUPS', 'Cantidad', 'TOTAL', '80/20']}
            data={tableCups}
            searchField={0}
            initialLimit={12}
          />

          <ExcelPivotTable
            title="Total acumulado por Artículo"
            columns={['Artículo', 'Cantidad', 'TOTAL', '80/20']}
            data={tableArticulos}
            searchField={0}
            initialLimit={12}
          />
        </section>
      </main>

      {/* Interactive Excel Export Filter Modal */}
      {isExportModalOpen && (
        <div className="modal-overlay" onClick={() => setIsExportModalOpen(false)}>
          <div className="export-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <FileSpreadsheet size={18} />
                Exportar a Microsoft Excel (.xlsx)
              </h2>
              <button className="modal-close-btn" onClick={() => setIsExportModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                <span><b>Año a Exportar:</b> {selectedAnio || '2026'}</span>
                {selectedTipo && <span><b>Tipo:</b> {selectedTipo}</span>}
                {selectedEspec && <span><b>Especialidad:</b> {selectedEspec}</span>}
              </div>

              {/* Month Selection */}
              <div>
                <div className="modal-section-title">
                  <span>Seleccionar Meses ({exportSelectedMonths.length} de 12)</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setExportSelectedMonths(ALL_12_MONTHS)}>Todos</button>
                    <span>·</span>
                    <button onClick={() => setExportSelectedMonths([])}>Ninguno</button>
                  </div>
                </div>
                <div className="modal-pills-grid">
                  {ALL_12_MONTHS.map(m => {
                    const isSelected = exportSelectedMonths.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        className={`modal-pill ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => toggleExportMonth(m)}
                      >
                        {isSelected && <Check size={12} style={{ display: 'inline', marginRight: 4 }} />}
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Day Selection */}
              <div>
                <div className="modal-section-title">
                  <span>Seleccionar Días del Mes ({exportSelectedDays.length} de 31)</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setExportSelectedDays(Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')))}>
                      Todos los días
                    </button>
                    <span>·</span>
                    <button onClick={() => setExportSelectedDays([])}>Ninguno</button>
                  </div>
                </div>
                <div className="modal-days-grid">
                  {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map(d => {
                    const isSelected = exportSelectedDays.includes(d);
                    return (
                      <div
                        key={d}
                        className={`modal-day-item ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => toggleExportDay(d)}
                        title={`Día ${d}`}
                      >
                        {d}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Summary Box */}
              <div className="modal-summary-box">
                <div>
                  <strong>Registros coincidentes para exportar:</strong>
                  <div style={{ fontSize: '11px', color: '#15803d' }}>
                    Incluye 5 hojas: Detalle, Por Cirujano, Por CUPS, Por Artículo y Total Mensual.
                  </div>
                </div>
                <strong style={{ fontSize: '15px' }}>
                  {exportMatchedRecords.length.toLocaleString('es-CO')}
                </strong>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="excel-btn"
                onClick={() => setIsExportModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="excel-btn excel-btn-excel"
                onClick={handleExecuteExcelExport}
                disabled={exportMatchedRecords.length === 0}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                <Download size={15} />
                Descargar Archivo Excel (.xlsx)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="dashboard-footer">
        <span>powered by statistics CNC 2026</span>
      </footer>
    </div>
  );
}
