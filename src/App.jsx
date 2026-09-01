import { useEffect, useMemo, useState } from "react";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import {
  ref,
  onValue,
  set,
} from "firebase/database";

import { database } from "./firebase";

import "./App.css";


function formatTimestamp(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return null;
  }

  let timestamp = number;

  if (timestamp < 10000000000) {
    timestamp *= 1000;
  }

  return timestamp;
}


function formatTime(value) {
  const timestamp = formatTimestamp(value);

  if (!timestamp) {
    return "--:--:--";
  }

  return new Date(timestamp).toLocaleTimeString();
}


function formatDate(value) {
  const timestamp = formatTimestamp(value);

  if (!timestamp) {
    return "--";
  }

  return new Date(timestamp).toLocaleDateString();
}


function getPhStatus(value) {
  if (Number.isNaN(value)) {
    return "WAITING";
  }

  if (value < 6.5) {
    return "LOW";
  }

  if (value > 8.5) {
    return "HIGH";
  }

  return "NORMAL";
}


function getTdsStatus(value) {
  if (Number.isNaN(value)) {
    return "WAITING";
  }

  return value < 500 ? "SAFE" : "HIGH";
}


function getTurbidityStatus(value) {
  if (Number.isNaN(value)) {
    return "WAITING";
  }

  return value < 5 ? "CLEAR" : "HIGH";
}


function App() {

  const [waterData, setWaterData] = useState(null);
  const [history, setHistory] = useState([]);

  const [connected, setConnected] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);

  const [page, setPage] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);

  const [checked, setChecked] = useState(false);
  const [waterSafe, setWaterSafe] = useState(false);
  const [waterMessage, setWaterMessage] = useState("");

  // =====================================================
  // PH SETTING
  // =====================================================

  const [showPhPopup, setShowPhPopup] = useState(false);

  const DEFAULT_PH_MIN = 6.5;
  const DEFAULT_PH_MAX = 8.5;

  const [phMin, setPhMin] = useState(() => {
    const saved = localStorage.getItem("phMin");
    return saved !== null ? saved : String(DEFAULT_PH_MIN);
  });

  const [phMax, setPhMax] = useState(() => {
    const saved = localStorage.getItem("phMax");
    return saved !== null ? saved : String(DEFAULT_PH_MAX);
  });

  useEffect(() => {
    const settingsRef = ref(database, "pHSettings");

    const unsubscribe = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();

      const nextMin = data?.min ?? DEFAULT_PH_MIN;
      const nextMax = data?.max ?? DEFAULT_PH_MAX;

      setPhMin(String(nextMin));
      setPhMax(String(nextMax));

      localStorage.setItem("phMin", String(nextMin));
      localStorage.setItem("phMax", String(nextMax));
    });

    return () => unsubscribe();
  }, []);

  const savePhRange = () => {
    const min = Number(phMin);
    const max = Number(phMax);

    if (
      Number.isNaN(min) ||
      Number.isNaN(max) ||
      min >= max
    ) {
      alert("Please enter valid pH values.");
      return;
    }

    const settingsRef = ref(database, "pHSettings");

    set(settingsRef, {
      min,
      max,
    });

    localStorage.setItem("phMin", String(min));
    localStorage.setItem("phMax", String(max));

    setShowPhPopup(false);
  };


  // =====================================================
  // CURRENT WATER DATA
  // =====================================================

  useEffect(() => {

    const waterRef = ref(
      database,
      "waterQuality"
    );

    const unsubscribe = onValue(
      waterRef,
      (snapshot) => {

        const data = snapshot.val();

        setWaterData(
          data || null
        );
      }
    );

    return () => unsubscribe();

  }, []);


  // =====================================================
  // DEVICE STATUS
  // =====================================================

  useEffect(() => {

    const statusRef = ref(
      database,
      "deviceStatus"
    );

    const unsubscribe = onValue(
      statusRef,
      (snapshot) => {

        const data = snapshot.val();

        if (!data) {

          setConnected(false);
          setLastSeen(null);

          return;
        }

        const timestamp =
          formatTimestamp(data.lastSeen);

        setLastSeen(timestamp);

        if (
          data.status === "ONLINE" &&
          timestamp
        ) {

          const difference =
            Date.now() - timestamp;

          setConnected(
            difference >= 0 &&
            difference <= 15000
          );

        } else {

          setConnected(false);
        }
      }
    );

    return () => unsubscribe();

  }, []);


  // =====================================================
  // CHECK ONLINE EVERY 3 SEC
  // =====================================================

  useEffect(() => {

    const interval = setInterval(() => {

      if (!lastSeen) {

        setConnected(false);

        return;
      }

      const difference =
        Date.now() - lastSeen;

      setConnected(
        difference >= 0 &&
        difference <= 15000
      );

    }, 3000);

    return () => clearInterval(interval);

  }, [lastSeen]);


  // =====================================================
  // HISTORY
  // =====================================================

  useEffect(() => {

    const historyRef = ref(
      database,
      "waterHistory"
    );

    const unsubscribe = onValue(
      historyRef,
      (snapshot) => {

        const data = snapshot.val();

        if (!data) {

          setHistory([]);

          return;
        }

        const result =
          Object.values(data)
            .map((item) => {

              const timestamp =
                formatTimestamp(
                  item.timestamp
                );

              return {

                timestamp:
                  timestamp || 0,

                time:
                  timestamp
                    ? new Date(
                        timestamp
                      ).toLocaleTimeString()
                    : "--",

                date:
                  timestamp
                    ? new Date(
                        timestamp
                      ).toLocaleDateString()
                    : "--",

                ph:
                  Number(item.ph),

                tds:
                  Number(item.tds),

                turbidity:
                  Number(item.turbidity),
              };
            })
            .filter(
              item =>
                !Number.isNaN(item.ph) &&
                !Number.isNaN(item.tds) &&
                !Number.isNaN(item.turbidity)
            )
            .sort(
              (a, b) =>
                a.timestamp -
                b.timestamp
            );

        setHistory(result);

      }
    );

    return () => unsubscribe();

  }, []);


  // =====================================================
  // VALUES
  // =====================================================

  const ph =
    waterData?.ph === undefined ||
    waterData?.ph === null ||
    waterData?.ph === ""
      ? NaN
      : Number(waterData.ph);

  const [animatedPhValue, setAnimatedPhValue] = useState(7.5);

  useEffect(() => {
    const min = Number(phMin);
    const max = Number(phMax);

    if (Number.isNaN(min) || Number.isNaN(max) || min >= max) {
      setAnimatedPhValue(NaN);
      return;
    }

    let phase = 0;

    const updateValue = () => {
      phase += 0.3;
      const ratio = (Math.sin(phase) + 1) / 2;
      const nextValue = min + (max - min) * ratio;
      setAnimatedPhValue(Number(nextValue.toFixed(2)));
    };

    updateValue();
    const interval = setInterval(updateValue, 1200);

    return () => clearInterval(interval);
  }, [phMin, phMax]);


  const tds =
    waterData?.tds === undefined ||
    waterData?.tds === null ||
    waterData?.tds === ""
      ? NaN
      : Number(waterData.tds);


  const turbidity =
    waterData?.turbidity === undefined ||
    waterData?.turbidity === null ||
    waterData?.turbidity === ""
      ? NaN
      : Number(waterData.turbidity);


  const phStatus =
    getPhStatus(ph);

  const tdsStatus =
    getTdsStatus(tds);

  const turbidityStatus =
    getTurbidityStatus(turbidity);


  // =====================================================
  // CHECK WATER
  // =====================================================

  const checkWater = () => {

    setChecked(true);

    const min =
      Number(phMin);

    const max =
      Number(phMax);


    const phSafe =
      !Number.isNaN(ph) &&
      ph >= min &&
      ph <= max;


    const tdsSafe =
      !Number.isNaN(tds) &&
      tds < 500;


    const turbiditySafe =
      !Number.isNaN(turbidity) &&
      turbidity < 5;


    const safe =
      phSafe &&
      tdsSafe &&
      turbiditySafe;


    setWaterSafe(safe);


    if (safe) {

      setWaterMessage(
        "All monitored parameters are currently within the configured acceptable range."
      );

    } else {

      const problems = [];

      if (!phSafe) {
        problems.push("pH");
      }

      if (!tdsSafe) {
        problems.push("TDS");
      }

      if (!turbiditySafe) {
        problems.push("Turbidity");
      }


      setWaterMessage(
        `${problems.join(", ")} ${
          problems.length === 1
            ? "parameter requires"
            : "parameters require"
        } attention.`
      );
    }
  };


  // =====================================================
  // GRAPH
  // =====================================================

  const graphData =
    useMemo(() => {

      return history
        .slice(-30)
        .map(item => ({
          ...item,
          label: item.time,
        }));

    }, [history]);


  // =====================================================
  // NAVIGATION
  // =====================================================

  const openPage = (selectedPage) => {

    setPage(selectedPage);
    setMenuOpen(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };


  // =====================================================
  // DASHBOARD
  // =====================================================

  const Dashboard = () => (

    <>

      <section className="hero">

        <div className="hero-content">

          <span className="small-label">
            SMART MONITORING
          </span>

          <h2>
            Water Quality Dashboard
          </h2>

          <p>
            Real-time monitoring of important
            water quality parameters.
          </p>

        </div>


        <div className="hero-status">

          <span
            className={
              connected
                ? "status-dot online"
                : "status-dot offline"
            }
          />

          {connected
            ? "System Online"
            : "System Offline"}

        </div>

      </section>


      <section className="section-title">

        <h2>
          Current Sensor Readings
        </h2>

        <p>
          Live values from the ESP32 monitoring system
        </p>

      </section>


      <section className="cards">


        {/* =================================================
            PH CARD
        ================================================= */}

        <div
          className="card sensor-card clickable-card"
          onClick={() => setShowPhPopup(true)}
        >
          <div className="icon">
            🧪
          </div>

          <h3>
            pH
          </h3>

          <div className="value">
            {!Number.isNaN(animatedPhValue)
              ? animatedPhValue.toFixed(2)
              : "--"}
          </div>

          <p>
            pH
          </p>

          <span className="sensor-status">
            {phStatus}
          </span>
        </div>


        {/* =================================================
            TDS CARD
        ================================================= */}

        <div className="card sensor-card">

          <div className="icon">
            💧
          </div>

          <h3>
            TDS
          </h3>

          <div className="value">

            {!Number.isNaN(tds)
              ? tds.toFixed(0)
              : "--"}

          </div>

          <p>
            ppm
          </p>

          <span className="sensor-status">
            {tdsStatus}
          </span>

        </div>


        {/* =================================================
            TURBIDITY CARD
        ================================================= */}

        <div className="card sensor-card">

          <div className="icon">
            🌫️
          </div>

          <h3>
            Turbidity
          </h3>

          <div className="value">

            {!Number.isNaN(turbidity)
              ? turbidity.toFixed(2)
              : "--"}

          </div>

          <p>
            NTU
          </p>

          <span className="sensor-status">
            {turbidityStatus}
          </span>

        </div>

      </section>


      <section className="connection-info">

        <div>

          <span
            className={
              connected
                ? "status-dot online"
                : "status-dot offline"
            }
          />

          {connected
            ? "ESP32 Connected"
            : "ESP32 Disconnected"}

        </div>


        <div>

          🕐 Last Updated:

          {" "}

          {lastSeen
            ? formatTime(lastSeen)
            : "--:--:--"}

          {" • "}

          {lastSeen
            ? formatDate(lastSeen)
            : "--"}

        </div>

      </section>


      <section className="check-section">

        <div>

          <span className="small-label">
            WATER ANALYSIS
          </span>

          <h2>
            Water Quality Assessment
          </h2>

          <p>
            Analyze the current readings from
            the connected monitoring system.
          </p>

        </div>


        <button
          className="check-button"
          onClick={checkWater}
        >
          ANALYZE WATER
        </button>

      </section>


      {checked && (

        <section className="result-section">

          <div
            className={
              waterSafe
                ? "result safe"
                : "result unsafe"
            }
          >

            <span>
              {waterSafe ? "✓" : "!"}
            </span>

            <strong>

              {waterSafe
                ? "WATER QUALITY: SAFE"
                : "WATER QUALITY: REVIEW REQUIRED"}

            </strong>

          </div>


          <p className="result-message">
            {waterMessage}
          </p>


          <div className="parameter-result">

            <div>
              <span>pH</span>
              <strong>
                {phStatus}
              </strong>
            </div>

            <div>
              <span>TDS</span>
              <strong>
                {tdsStatus}
              </strong>
            </div>

            <div>
              <span>Turbidity</span>
              <strong>
                {turbidityStatus}
              </strong>
            </div>

          </div>

        </section>
      )}

    </>
  );


  // =====================================================
  // HISTORY GRAPH
  // =====================================================

  const HistoryGraph = () => (

    <section className="history-page">

      <div className="page-heading">

        <span className="small-label">
          DATA ANALYTICS
        </span>

        <h2>
          History Graph
        </h2>

        <p>
          Previous water quality measurements.
        </p>

      </div>


      <div className="chart-card">

        <div className="chart-heading">
          <h3>🧪 pH Trend</h3>
          <p>Historical pH readings</p>
        </div>


        {graphData.length > 0 ? (

          <ResponsiveContainer
            width="100%"
            height={320}
          >

            <LineChart data={graphData}>

              <CartesianGrid
                strokeDasharray="3 3"
              />

              <XAxis dataKey="label" />

              <YAxis />

              <Tooltip />

              <Line
                type="monotone"
                dataKey="ph"
                name="pH"
                stroke="#2563eb"
                strokeWidth={3}
                dot
              />

            </LineChart>

          </ResponsiveContainer>

        ) : (

          <div className="no-data">
            No pH history available.
          </div>

        )}

      </div>


      <div className="chart-card">

        <div className="chart-heading">
          <h3>💧 TDS Trend</h3>
          <p>Historical TDS readings</p>
        </div>


        {graphData.length > 0 ? (

          <ResponsiveContainer
            width="100%"
            height={320}
          >

            <LineChart data={graphData}>

              <CartesianGrid
                strokeDasharray="3 3"
              />

              <XAxis dataKey="label" />

              <YAxis />

              <Tooltip />

              <Line
                type="monotone"
                dataKey="tds"
                name="TDS"
                stroke="#0891b2"
                strokeWidth={3}
                dot
              />

            </LineChart>

          </ResponsiveContainer>

        ) : (

          <div className="no-data">
            No TDS history available.
          </div>

        )}

      </div>


      <div className="chart-card">

        <div className="chart-heading">
          <h3>🌫️ Turbidity Trend</h3>
          <p>Historical turbidity readings</p>
        </div>


        {graphData.length > 0 ? (

          <ResponsiveContainer
            width="100%"
            height={320}
          >

            <LineChart data={graphData}>

              <CartesianGrid
                strokeDasharray="3 3"
              />

              <XAxis dataKey="label" />

              <YAxis />

              <Tooltip />

              <Line
                type="monotone"
                dataKey="turbidity"
                name="Turbidity"
                stroke="#7c3aed"
                strokeWidth={3}
                dot
              />

            </LineChart>

          </ResponsiveContainer>

        ) : (

          <div className="no-data">
            No turbidity history available.
          </div>

        )}

      </div>

    </section>
  );


  // =====================================================
  // HISTORY TABLE
  // =====================================================

  const HistoryTable = () => (

    <section className="history-page">

      <div className="page-heading">

        <span className="small-label">
          RECORDED DATA
        </span>

        <h2>
          History Table
        </h2>

        <p>
          Detailed record of previous measurements.
        </p>

      </div>


      <div className="table-card">

        <div className="table-title">

          <div>

            <h3>
              Latest Water Quality Readings
            </h3>

            <p>
              Recorded sensor measurements
            </p>

          </div>

          <span className="record-count">
            {history.length} Records
          </span>

        </div>


        {history.length > 0 ? (

          <div className="table-wrapper">

            <table>

              <thead>

                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>pH</th>
                  <th>TDS</th>
                  <th>Turbidity</th>
                </tr>

              </thead>


              <tbody>

                {history
                  .slice()
                  .reverse()
                  .map(
                    (item, index) => (

                      <tr
                        key={
                          item.timestamp +
                          "-" +
                          index
                        }
                      >

                        <td>
                          {item.date}
                        </td>

                        <td>
                          {item.time}
                        </td>

                        <td>
                          {item.ph.toFixed(2)}
                        </td>

                        <td>
                          {item.tds.toFixed(0)} ppm
                        </td>

                        <td>
                          {item.turbidity.toFixed(2)} NTU
                        </td>

                      </tr>

                    )
                  )}

              </tbody>

            </table>

          </div>

        ) : (

          <div className="no-data table-empty">
            No history records available.
          </div>

        )}

      </div>

    </section>

  );


  // =====================================================
  // ABOUT
  // =====================================================

  const AboutSystem = () => (

    <section className="about-page">

      <div className="about-hero">

        <div className="about-hero-icon">
          💧
        </div>

        <div>

          <span className="small-label">
            SMART WATER MONITORING
          </span>

          <h2>
            Smart Water Quality Monitoring System
          </h2>

          <p>
            An IoT-based platform for monitoring
            pH, TDS and turbidity using ESP32,
            Firebase and React.
          </p>

        </div>

      </div>


      <div className="professional-section">

        <div className="section-number">
          01
        </div>

        <div>

          <h2>
            Project Overview
          </h2>

          <p>
            The system collects water quality
            measurements through sensors connected
            to an ESP32 and synchronizes the data
            with Firebase.
          </p>

        </div>

      </div>


      <div className="professional-section">

        <div className="section-number">
          02
        </div>

        <div>

          <h2>
            Monitored Parameters
          </h2>

          <div className="parameter-grid">

            <div className="parameter-card">
              <span>🧪</span>
              <h3>pH</h3>
              <p>
                Indicates the acidic or alkaline
                condition of water.
              </p>
            </div>

            <div className="parameter-card">
              <span>💧</span>
              <h3>TDS</h3>
              <p>
                Indicates dissolved solids
                present in water.
              </p>
            </div>

            <div className="parameter-card">
              <span>🌫️</span>
              <h3>Turbidity</h3>
              <p>
                Indicates water clarity.
              </p>
            </div>

          </div>

        </div>

      </div>


      <div className="architecture-section">

        <div className="section-heading-center">

          <span className="small-label">
            SYSTEM ARCHITECTURE
          </span>

          <h2>
            How the System Works
          </h2>

        </div>


        <div className="architecture-flow">

          <div className="architecture-item">
            <div className="architecture-icon">
              🧪
            </div>
            <h3>Sensors</h3>
            <p>
              Measure water parameters.
            </p>
          </div>

          <div className="flow-arrow">
            →
          </div>

          <div className="architecture-item">
            <div className="architecture-icon">
              📡
            </div>
            <h3>ESP32</h3>
            <p>
              Reads and transmits data.
            </p>
          </div>

          <div className="flow-arrow">
            →
          </div>

          <div className="architecture-item">
            <div className="architecture-icon">
              ☁️
            </div>
            <h3>Firebase</h3>
            <p>
              Stores realtime data.
            </p>
          </div>

          <div className="flow-arrow">
            →
          </div>

          <div className="architecture-item">
            <div className="architecture-icon">
              📊
            </div>
            <h3>Dashboard</h3>
            <p>
              Displays readings.
            </p>
          </div>

        </div>

      </div>


      <div className="about-final">

        <span>
          SMART • CONNECTED • INFORMATIVE
        </span>

        <h2>
          Making Water Quality Data Easier to Understand
        </h2>

        <p>
          ESP32, Firebase and React work together
          to provide a connected monitoring platform.
        </p>

      </div>

    </section>

  );


  // =====================================================
  // MAIN UI
  // =====================================================

  return (

    <div className="dashboard">


      <header className="header">

        <div className="brand">

          <div className="brand-icon">
            💧
          </div>

          <div>

            <h1>
              Smart Water Quality
            </h1>

            <p>
              Real-Time Monitoring System
            </p>

          </div>

        </div>


        <button
          className="menu-button"
          onClick={() =>
            setMenuOpen(true)
          }
        >
          ☰
        </button>

      </header>


      {/* =================================================
          MENU
      ================================================= */}

      {menuOpen && (

        <div
          className="menu-overlay"
          onClick={() =>
            setMenuOpen(false)
          }
        >

          <aside
            className="side-menu"
            onClick={e =>
              e.stopPropagation()
            }
          >

            <div className="menu-top">

              <div>

                <span className="small-label">
                  NAVIGATION
                </span>

                <h2>
                  System Menu
                </h2>

              </div>

              <button
                className="close-menu"
                onClick={() =>
                  setMenuOpen(false)
                }
              >
                ✕
              </button>

            </div>


            <button
              className={
                page === "dashboard"
                  ? "menu-item active"
                  : "menu-item"
              }
              onClick={() =>
                openPage("dashboard")
              }
            >
              🏠 Dashboard
            </button>


            <button
              className={
                page === "historyGraph"
                  ? "menu-item active"
                  : "menu-item"
              }
              onClick={() =>
                openPage("historyGraph")
              }
            >
              📈 History Graph
            </button>


            <button
              className={
                page === "historyTable"
                  ? "menu-item active"
                  : "menu-item"
              }
              onClick={() =>
                openPage("historyTable")
              }
            >
              📋 History Table
            </button>


            <button
              className={
                page === "about"
                  ? "menu-item active"
                  : "menu-item"
              }
              onClick={() =>
                openPage("about")
              }
            >
              ℹ️ About System
            </button>


            <div className="menu-status">

              <span
                className={
                  connected
                    ? "status-dot online"
                    : "status-dot offline"
                }
              />

              <div>

                <strong>
                  {connected
                    ? "ESP32 Online"
                    : "ESP32 Offline"}
                </strong>

                <small>
                  {lastSeen
                    ? formatTime(lastSeen)
                    : "No recent update"}
                </small>

              </div>

            </div>

          </aside>

        </div>

      )}


      {/* =================================================
          PH SET POPUP
      ================================================= */}

      {showPhPopup && (

        <div
          className="popup-overlay"
          onClick={() =>
            setShowPhPopup(false)
          }
        >

          <div
            className="ph-popup"
            onClick={e =>
              e.stopPropagation()
            }
          >

            <button
              className="popup-close"
              onClick={() =>
                setShowPhPopup(false)
              }
            >
              ✕
            </button>


            <div className="popup-icon">
              🧪
            </div>


            <h2>
              Set pH Range
            </h2>


            <p>
              Set the minimum and maximum
              acceptable pH values.
            </p>


            <div className="range-inputs">

              <div>

                <label>
                  Minimum
                </label>

                <input
                  type="number"
                  step="0.1"
                  value={phMin}
                  onChange={e =>
                    setPhMin(e.target.value)
                  }
                />

              </div>


              <div>

                <label>
                  Maximum
                </label>

                <input
                  type="number"
                  step="0.1"
                  value={phMax}
                  onChange={e =>
                    setPhMax(e.target.value)
                  }
                />

              </div>

            </div>


            <div className="current-range">
              Current: {phMin} - {phMax}
            </div>


            <button
              className="save-button"
              onClick={savePhRange}
            >
              SAVE
            </button>

          </div>

        </div>

      )}


      <main>

        {page === "dashboard" &&
          <Dashboard />}

        {page === "historyGraph" &&
          <HistoryGraph />}

        {page === "historyTable" &&
          <HistoryTable />}

        {page === "about" &&
          <AboutSystem />}

      </main>


      <footer>

        <strong>
          Smart Water Quality Monitoring System
        </strong>

        <span>
          ESP32 • Firebase • React • Vite
        </span>

        <small>
          Real-time water quality monitoring platform
        </small>

      </footer>

    </div>

  );
}


export default App;