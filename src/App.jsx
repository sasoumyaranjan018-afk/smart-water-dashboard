import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ref, onValue, push, set } from "firebase/database";
import { database } from "./firebase";
import "./App.css";

function App() {
  const [waterData, setWaterData] = useState(null);
  const [history, setHistory] = useState([]);

  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("--:--:--");

  // Manual pH
  const [manualPh, setManualPh] = useState("");
  const [savedPh, setSavedPh] = useState(null);

  // Water checking
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // ================= CURRENT DATA =================
    const waterRef = ref(database, "waterQuality");

    const unsubscribeWater = onValue(
      waterRef,
      (snapshot) => {
        const data = snapshot.val();

        if (data) {
          setWaterData(data);
          setConnected(true);

          if (data.lastSeen) {
            const date = new Date(Number(data.lastSeen));
            if (!isNaN(date.getTime())) {
              setLastUpdated(date.toLocaleTimeString());
            }
          }
        }
      },
      () => {
        setConnected(false);
      }
    );

    // ================= HISTORY =================
    const historyRef = ref(database, "waterHistory");

    const unsubscribeHistory = onValue(historyRef, (snapshot) => {
      const data = snapshot.val();

      if (!data) {
        setHistory([]);
        return;
      }

      const historyData = Object.values(data)
        .map((item) => {
          const timestamp = Number(item.timestamp);

          return {
            time: !isNaN(timestamp)
              ? new Date(timestamp).toLocaleTimeString()
              : "--:--:--",

            ph: Number(item.ph),
            tds: Number(item.tds),
            turbidity: Number(item.turbidity),

            timestamp,
          };
        })
        .filter(
          (item) =>
            !isNaN(item.ph) &&
            !isNaN(item.tds) &&
            !isNaN(item.turbidity)
        )
        .sort((a, b) => a.timestamp - b.timestamp);

      setHistory(historyData.slice(-20));
    });

    return () => {
      unsubscribeWater();
      unsubscribeHistory();
    };
  }, []);

  // ================= SENSOR VALUES =================

  const sensorTds = Number(waterData?.tds);
  const sensorTurbidity = Number(waterData?.turbidity);

  // Manual pH has priority
  const currentPh =
    savedPh !== null ? Number(savedPh) : null;

  // ================= STATUS =================

  let phStatus = "NOT SET";

  if (currentPh !== null && !isNaN(currentPh)) {
    if (currentPh < 6.5) {
      phStatus = "LOW";
    } else if (currentPh > 8.5) {
      phStatus = "HIGH";
    } else {
      phStatus = "NORMAL";
    }
  }

  let tdsStatus = "WAITING";

  if (!isNaN(sensorTds)) {
    tdsStatus = sensorTds < 500 ? "SAFE" : "HIGH";
  }

  let turbidityStatus = "WAITING";

  if (!isNaN(sensorTurbidity)) {
    turbidityStatus =
      sensorTurbidity < 5 ? "CLEAR" : "HIGH";
  }

  // ================= CHECK WATER =================

  const checkWater = () => {
    setChecked(true);
  };

  let overallStatus = "READY TO CHECK";
  let statusMessage =
    "Enter a manual pH reading and click Check Water.";

  let problems = [];

  if (checked) {
    if (currentPh === null || isNaN(currentPh)) {
      overallStatus = "pH REQUIRED";
      statusMessage = "Please enter a pH reading first.";
    } else {
      const phSafe = currentPh >= 6.5 && currentPh <= 8.5;
      const tdsSafe =
        !isNaN(sensorTds) && sensorTds < 500;
      const turbiditySafe =
        !isNaN(sensorTurbidity) && sensorTurbidity < 5;

      if (phSafe && tdsSafe && turbiditySafe) {
        overallStatus = "WATER SAFE";
        statusMessage =
          "All monitored parameters are within the selected safe range.";
      } else {
        overallStatus = "WATER UNSAFE";

        if (!phSafe) problems.push("pH");
        if (!tdsSafe) problems.push("TDS");
        if (!turbiditySafe) problems.push("Turbidity");

        statusMessage =
          problems.length > 0
            ? `Check: ${problems.join(", ")}`
            : "One or more parameters are outside the safe range.";
      }
    }
  }

  // ================= SAVE MANUAL PH =================

  const saveManualPh = async () => {
    const value = Number(manualPh);

    if (isNaN(value) || value < 0 || value > 14) {
      alert("Please enter a valid pH value between 0 and 14.");
      return;
    }

    setSavedPh(value);
    setChecked(false);

    try {
      const manualRef = ref(database, "manualPH");
      const newRef = push(manualRef);

      await set(newRef, {
        ph: value,
        timestamp: Date.now(),
      });

      alert("Manual pH reading saved successfully!");
    } catch (error) {
      console.error(error);
      alert("pH saved on dashboard, but Firebase save failed.");
    }
  };

  return (
    <div className="dashboard">

      {/* ================= HEADER ================= */}

      <header className="header">
        <div>
          <h1>💧 Smart Water Quality</h1>
          <p>Real-Time Water Monitoring System</p>
        </div>

        <div className="live">
          <span
            className={
              connected
                ? "live-dot online"
                : "live-dot offline"
            }
          ></span>

          {connected ? "ONLINE" : "OFFLINE"}
        </div>
      </header>

      <main>

        {/* ================= SENSOR READINGS ================= */}

        <section className="section">

          <div className="section-title">
            <h2>📡 Sensor Readings</h2>
            <p>Current water quality parameters</p>
          </div>

          <div className="cards">

            {/* pH */}

            <div className="card ph-card">

              <div className="icon">🧪</div>

              <h3>pH Level</h3>

              <div className="value">
                {currentPh !== null
                  ? currentPh.toFixed(2)
                  : "--"}
              </div>

              <p>Range: 0 – 14</p>

              <div className="sensor-status">
                {phStatus}
              </div>

            </div>

            {/* TDS */}

            <div className="card">

              <div className="icon">💧</div>

              <h3>TDS</h3>

              <div className="value">
                {!isNaN(sensorTds)
                  ? sensorTds.toFixed(0)
                  : "--"}
              </div>

              <p>ppm</p>

              <div className="sensor-status">
                {tdsStatus}
              </div>

            </div>

            {/* TURBIDITY */}

            <div className="card">

              <div className="icon">🌫️</div>

              <h3>Turbidity</h3>

              <div className="value">
                {!isNaN(sensorTurbidity)
                  ? sensorTurbidity.toFixed(2)
                  : "--"}
              </div>

              <p>NTU</p>

              <div className="sensor-status">
                {turbidityStatus}
              </div>

            </div>

          </div>

          <div className="connection-info">

            <div>
              <span
                className={
                  connected
                    ? "status-dot online"
                    : "status-dot offline"
                }
              ></span>

              {connected
                ? "ESP32 / Firebase Connected"
                : "ESP32 / Firebase Offline"}
            </div>

            <div>
              🕐 Last Updated: {lastUpdated}
            </div>

          </div>

        </section>

        {/* ================= CHECK WATER ================= */}

        <section className="check-section">

          <h2>🔍 Check Water Quality</h2>

          <p>
            Analyze the current sensor readings and determine
            whether the water is safe.
          </p>

          <button
            className="check-button"
            onClick={checkWater}
          >
            CHECK WATER
          </button>

        </section>

        {/* ================= RESULT ================= */}

        {checked && (
          <section className="result-section">

            <h2>💧 Water Quality Result</h2>

            <div
              className={
                overallStatus === "WATER SAFE"
                  ? "result safe"
                  : overallStatus === "WATER UNSAFE"
                  ? "result unsafe"
                  : "result warning"
              }
            >
              {overallStatus}
            </div>

            <p>{statusMessage}</p>

          </section>
        )}

        {/* ================= HISTORY ================= */}

        <section className="section history-section">

          <div className="section-title">
            <h2>📊 Reading History</h2>
            <p>Last 20 recorded sensor readings</p>
          </div>

          {/* pH */}

          <div className="chart-card">

            <h3>🧪 pH History</h3>

            <ResponsiveContainer width="100%" height={300}>

              <LineChart data={history}>

                <CartesianGrid strokeDasharray="3 3" />

                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11 }}
                />

                <YAxis domain={[0, 14]} />

                <Tooltip />

                <Line
                  type="monotone"
                  dataKey="ph"
                  stroke="#0b5ed7"
                  strokeWidth={3}
                  dot={true}
                />

              </LineChart>

            </ResponsiveContainer>

          </div>

          {/* TDS */}

          <div className="chart-card">

            <h3>💧 TDS History</h3>

            <ResponsiveContainer width="100%" height={300}>

              <LineChart data={history}>

                <CartesianGrid strokeDasharray="3 3" />

                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11 }}
                />

                <YAxis />

                <Tooltip />

                <Line
                  type="monotone"
                  dataKey="tds"
                  stroke="#0891b2"
                  strokeWidth={3}
                  dot={true}
                />

              </LineChart>

            </ResponsiveContainer>

          </div>

          {/* Turbidity */}

          <div className="chart-card">

            <h3>🌫️ Turbidity History</h3>

            <ResponsiveContainer width="100%" height={300}>

              <LineChart data={history}>

                <CartesianGrid strokeDasharray="3 3" />

                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11 }}
                />

                <YAxis />

                <Tooltip />

                <Line
                  type="monotone"
                  dataKey="turbidity"
                  stroke="#7c3aed"
                  strokeWidth={3}
                  dot={true}
                />

              </LineChart>

            </ResponsiveContainer>

          </div>

        </section>

        {/* ================= MANUAL PH ================= */}

        <section className="manual-ph-section">

          <div className="manual-header">
            <h2>🧪 Manual pH Reading</h2>

            <p>
              Enter the pH value manually because the pH sensor
              is currently unavailable.
            </p>
          </div>

          <div className="manual-form">

            <input
              type="number"
              min="0"
              max="14"
              step="0.01"
              placeholder="Enter pH (0 - 14)"
              value={manualPh}
              onChange={(e) => setManualPh(e.target.value)}
            />

            <button
              className="save-button"
              onClick={saveManualPh}
            >
              SAVE pH
            </button>

          </div>

          {savedPh !== null && (
            <div className="manual-result">

              Current Manual pH:

              <strong>
                {Number(savedPh).toFixed(2)}
              </strong>

              <span
                className={
                  phStatus === "NORMAL"
                    ? "normal-text"
                    : "warning-text"
                }
              >
                {phStatus}
              </span>

            </div>
          )}

        </section>

      </main>

      <footer>
        Smart Water Quality Monitoring System
        <br />
        ESP32 • Firebase • React
      </footer>

    </div>
  );
}

export default App;