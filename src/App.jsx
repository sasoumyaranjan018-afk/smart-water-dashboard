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

import { ref, onValue } from "firebase/database";
import { database } from "./firebase";

import "./App.css";


function App() {

  // =================================================
  // STATES
  // =================================================

  const [waterData, setWaterData] = useState(null);

  const [history, setHistory] = useState([]);

  const [deviceStatus, setDeviceStatus] = useState("OFFLINE");

  const [lastSeen, setLastSeen] = useState(null);

  const [lastUpdated, setLastUpdated] = useState("--:--:--");


  // =================================================
  // FIREBASE
  // =================================================

  useEffect(() => {

    // CURRENT WATER DATA
    const waterRef =
      ref(database, "waterQuality");


    // HISTORY
    const historyRef =
      ref(database, "waterHistory");


    // DEVICE STATUS
    const deviceRef =
      ref(database, "deviceStatus");


    // =================================================
    // CURRENT SENSOR DATA
    // =================================================

    const unsubscribeWater = onValue(
      waterRef,
      (snapshot) => {

        const data = snapshot.val();

        if (data) {

          setWaterData(data);

        }

      }
    );


    // =================================================
    // DEVICE STATUS
    // =================================================

    const unsubscribeDevice = onValue(
      deviceRef,
      (snapshot) => {

        const data = snapshot.val();

        if (!data) {

          setDeviceStatus("OFFLINE");

          setLastSeen(null);

          return;
        }


        // Last seen timestamp

        if (data.lastSeen) {

          const timestamp =
            Number(data.lastSeen);

          setLastSeen(timestamp);

          setLastUpdated(
            new Date(
              timestamp * 1000
            ).toLocaleTimeString()
          );
        }


        // =================================================
        // CHECK IF DEVICE IS REALLY ONLINE
        // =================================================

        if (data.lastSeen) {

          const now =
            Math.floor(
              Date.now() / 1000
            );

          const difference =
            now - Number(data.lastSeen);


          /*
            ESP32 sends data every 5 seconds.

            If lastSeen is less than 15 seconds old,
            consider ESP32 ONLINE.
          */

          if (difference <= 15) {

            setDeviceStatus("ONLINE");

          } else {

            setDeviceStatus("OFFLINE");

          }

        } else {

          setDeviceStatus("OFFLINE");

        }

      }
    );


    // =================================================
    // HISTORY
    // =================================================

    const unsubscribeHistory = onValue(
      historyRef,
      (snapshot) => {

        const data =
          snapshot.val();


        if (!data) {

          setHistory([]);

          return;
        }


        const historyData =
          Object.values(data)

            .map((item) => {

              const timestamp =
                Number(item.timestamp);


              return {

                time:
                  !isNaN(timestamp)

                    ? new Date(
                        timestamp * 1000
                      ).toLocaleTimeString()

                    : "--:--:--",


                ph:
                  Number(item.ph),


                tds:
                  Number(item.tds),


                turbidity:
                  Number(item.turbidity),


                timestamp:
                  timestamp

              };

            })


            .filter((item) =>

              !isNaN(item.ph) &&

              !isNaN(item.tds) &&

              !isNaN(item.turbidity)

            )


            .sort(
              (a, b) =>
                a.timestamp - b.timestamp
            );


        // Last 20 readings

        setHistory(
          historyData.slice(-20)
        );

      }
    );


    // =================================================
    // CLEANUP
    // =================================================

    return () => {

      unsubscribeWater();

      unsubscribeDevice();

      unsubscribeHistory();

    };

  }, []);


  // =================================================
  // CURRENT VALUES
  // =================================================

  const ph =
    Number(waterData?.ph);


  const tds =
    Number(waterData?.tds);


  const turbidity =
    Number(waterData?.turbidity);


  // =================================================
  // pH STATUS
  // =================================================

  let phStatus = "WAITING...";


  if (!isNaN(ph)) {

    if (ph < 6.5) {

      phStatus = "LOW";

    }

    else if (ph > 8.5) {

      phStatus = "HIGH";

    }

    else {

      phStatus = "NORMAL";

    }

  }


  // =================================================
  // TDS STATUS
  // =================================================

  let tdsStatus = "WAITING...";


  if (!isNaN(tds)) {

    if (tds < 500) {

      tdsStatus = "SAFE";

    }

    else {

      tdsStatus = "HIGH";

    }

  }


  // =================================================
  // TURBIDITY STATUS
  // =================================================

  let turbidityStatus =
    "WAITING...";


  if (!isNaN(turbidity)) {

    if (turbidity < 5) {

      turbidityStatus = "CLEAR";

    }

    else {

      turbidityStatus = "HIGH";

    }

  }


  // =================================================
  // OVERALL WATER QUALITY
  // =================================================

  let overallStatus =
    "WAITING...";


  let statusMessage =
    "Waiting for sensor readings...";


  if (

    !isNaN(ph) &&

    !isNaN(tds) &&

    !isNaN(turbidity)

  ) {

    const phSafe =
      ph >= 6.5 &&
      ph <= 8.5;


    const tdsSafe =
      tds < 500;


    const turbiditySafe =
      turbidity < 5;


    if (
      phSafe &&
      tdsSafe &&
      turbiditySafe
    ) {

      overallStatus =
        "WATER SAFE";


      statusMessage =
        "All monitored parameters are within the safe range.";

    }

    else {

      overallStatus =
        "WATER UNSAFE";


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


      statusMessage =
        "Check: " +
        problems.join(", ");

    }

  }


  // =================================================
  // RENDER
  // =================================================

  return (

    <div className="dashboard">


      {/* =================================================
          HEADER
      ================================================= */}

      <header className="header">

        <div>

          <h1>
            💧 Smart Water Quality
          </h1>

          <p>
            Real-Time Monitoring Dashboard
          </p>

        </div>


        {/* =================================================
            REAL DEVICE STATUS
        ================================================= */}

        <div
          className={
            deviceStatus === "ONLINE"
              ? "live active"
              : "live"
          }
        >

          <span></span>

          {deviceStatus === "ONLINE"
            ? "ONLINE"
            : "OFFLINE"}

        </div>

      </header>


      <main>


        {/* =================================================
            CONNECTION CARD
        ================================================= */}

        <section className="connection-card">


          <div className="connection-item">


            <span
              className={
                deviceStatus === "ONLINE"
                  ? "connection-dot connected"
                  : "connection-dot"
              }
            ></span>


            <div>

              <strong>

                {deviceStatus === "ONLINE"
                  ? "ESP32 Connected"
                  : "ESP32 Disconnected"}

              </strong>


              <small>
                Firebase device status
              </small>

            </div>

          </div>


          {/* =================================================
              LAST UPDATED
          ================================================= */}

          <div className="last-updated">

            <span>🕐</span>

            <div>

              <strong>
                Last Updated
              </strong>


              <small>

                {lastUpdated}

              </small>

            </div>

          </div>


        </section>


        {/* =================================================
            SENSOR CARDS
        ================================================= */}

        <section className="cards">


          {/* pH */}

          <div className="card">

            <div className="icon">
              🧪
            </div>


            <h3>
              pH Level
            </h3>


            <div className="value">

              {!isNaN(ph)
                ? ph.toFixed(2)
                : "--"}

            </div>


            <p>
              Ideal: 6.5 – 8.5
            </p>


            <div className="sensor-status">

              {phStatus}

            </div>

          </div>


          {/* TDS */}

          <div className="card">

            <div className="icon">
              💧
            </div>


            <h3>
              TDS
            </h3>


            <div className="value">

              {!isNaN(tds)
                ? tds.toFixed(0)
                : "--"}

            </div>


            <p>
              ppm
            </p>


            <div className="sensor-status">

              {tdsStatus}

            </div>

          </div>


          {/* TURBIDITY */}

          <div className="card">

            <div className="icon">
              🌫️
            </div>


            <h3>
              Turbidity
            </h3>


            <div className="value">

              {!isNaN(turbidity)
                ? turbidity.toFixed(2)
                : "--"}

            </div>


            <p>
              NTU
            </p>


            <div className="sensor-status">

              {turbidityStatus}

            </div>

          </div>

        </section>


        {/* =================================================
            OVERALL STATUS
        ================================================= */}

        <section className="status-card">


          <h2>
            💧 Overall Water Quality
          </h2>


          <div
            className={
              overallStatus === "WATER SAFE"
                ? "status safe"

                : overallStatus === "WATER UNSAFE"
                ? "status unsafe"

                : "status"
            }
          >

            {overallStatus}

          </div>


          <p>
            {statusMessage}
          </p>


        </section>


        {/* =================================================
            GRAPHS
        ================================================= */}

        <section className="charts">


          {/* pH */}

          <div className="chart-card">

            <h2>
              🧪 pH History
            </h2>


            <ResponsiveContainer
              width="100%"
              height={300}
            >

              <LineChart
                data={history}
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                />


                <XAxis
                  dataKey="time"
                />


                <YAxis
                  domain={[0, 14]}
                />


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

            <h2>
              💧 TDS History
            </h2>


            <ResponsiveContainer
              width="100%"
              height={300}
            >

              <LineChart
                data={history}
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                />


                <XAxis
                  dataKey="time"
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


          {/* TURBIDITY */}

          <div className="chart-card">

            <h2>
              🌫️ Turbidity History
            </h2>


            <ResponsiveContainer
              width="100%"
              height={300}
            >

              <LineChart
                data={history}
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                />


                <XAxis
                  dataKey="time"
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


        {/* =================================================
            READING HISTORY
        ================================================= */}

        <section className="history-section">


          <div className="history-title">

            <div>

              <h2>
                📊 Reading History
              </h2>

              <p>
                Latest 20 sensor readings
              </p>

            </div>


            <div className="history-count">

              {history.length} Readings

            </div>

          </div>


          {history.length === 0 ? (

            <div className="no-history">

              <div className="empty-icon">
                📊
              </div>

              <h3>
                No History Available
              </h3>

              <p>
                Sensor readings will appear here.
              </p>

            </div>

          ) : (

            <div className="table-wrapper">

              <table>

                <thead>

                  <tr>

                    <th>
                      #
                    </th>

                    <th>
                      Time
                    </th>

                    <th>
                      pH
                    </th>

                    <th>
                      TDS (ppm)
                    </th>

                    <th>
                      Turbidity (NTU)
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {history.map(
                    (item, index) => (

                      <tr
                        key={
                          item.timestamp +
                          "-" +
                          index
                        }
                      >

                        <td>
                          {index + 1}
                        </td>

                        <td>
                          {item.time}
                        </td>

                        <td>
                          {item.ph.toFixed(2)}
                        </td>

                        <td>
                          {item.tds.toFixed(0)}
                        </td>

                        <td>
                          {item.turbidity.toFixed(2)}
                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          )}

        </section>


      </main>


      {/* =================================================
          FOOTER
      ================================================= */}

      <footer>

        Smart Water Quality Monitoring System
        • ESP32 + Firebase

      </footer>


    </div>

  );

}


export default App;