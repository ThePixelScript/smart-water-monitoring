// --- Theme Toggle ---
const themeToggle = document.getElementById('themeToggle');
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  themeToggle.innerText = document.body.classList.contains('dark-mode')
    ? '☀️ Light Mode'
    : '🌙 Dark Mode';
});
// --- Chart Setup ---
const charts = {};
const sensors = ['level', 'temp', 'ph', 'tds'];
const thresholds = {
  level: { min: 30, max: 80, dangerMin: 25, dangerMax: 90 },
  temp:  { min: 20, max: 30, dangerMin: 18, dangerMax: 35 },
  ph:    { min: 6.5, max: 8.0, dangerMin: 6.0, dangerMax: 8.5 },
  tds:   { min: 300, max: 600, dangerMin: 200, dangerMax: 1000 }
};
let lastUpdateTime = Date.now();
let dataTimeoutNotified = false;
let blinkIntervals = {};
sensors.forEach(id => {
  const ctx = document.getElementById(id + 'Chart').getContext('2d');
  charts[id] = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: id.toUpperCase(), data: [], borderColor: '#0077ff', backgroundColor: 'rgba(0,119,255,0.2)', tension: 0.3, fill: true, pointRadius: 0 }] },
    options: { scales: { x: { display: false } } }
  });
});
// --- Notification System ---
function showNotification(message, type='normal', duration=5000) {
  const container = document.getElementById('notifications-container');
  const existingMessages = Array.from(container.children).map(n => n.innerText);
  if (existingMessages.includes(message)) return;
  if (container.children.length >= 7) container.removeChild(container.lastChild);
  const notif = document.createElement('div');
  notif.className = `notification ${type}`;
  notif.innerText = message;
  container.prepend(notif);
  setTimeout(() => {
    notif.style.opacity = 0;
    notif.style.transform = "translateY(-20px)";
    setTimeout(() => { if (notif.parentNode) container.removeChild(notif); }, 1000);
  }, duration);
}
function startBlink(chart) {
  if (blinkIntervals[chart]) return;
  let on = false;
  blinkIntervals[chart] = setInterval(() => {
    chart.data.datasets[0].backgroundColor = on ? 'rgba(255,0,0,0.2)' : 'rgba(255,0,0,0.05)';
    chart.update();
    on = !on;
  }, 500);
}
function stopBlink(chart) {
  if (blinkIntervals[chart]) {
    clearInterval(blinkIntervals[chart]);
    blinkIntervals[chart] = null;
    chart.data.datasets[0].backgroundColor = 'rgba(0,119,255,0.2)';
    chart.update();
  }
}
// --- Data Fetching ---
async function fetchData() {
  try {
    const response = await fetch('/api/data');
    if (!response.ok) throw new Error("Network error");
    const data = await response.json();
    if (data.stale) {
      if (!dataTimeoutNotified) {
        showNotification("🚨 No new sensor data received for 15 seconds!", "danger", 15000);
        sensors.forEach(id => {
          document.getElementById(id + 'Value').innerText = 'No Data';
          const chart = charts[id];
          chart.data.labels = [];
          chart.data.datasets[0].data = [];
          chart.update();
          startBlink(chart);
        });
        dataTimeoutNotified = true;
      }
      return;
    }
    dataTimeoutNotified = false;
    sensors.forEach(id => stopBlink(charts[id]));
    lastUpdateTime = Date.now();
    document.getElementById('levelValue').innerText = data.level + ' cm';
    document.getElementById('tempValue').innerText = data.temp + ' °C';
    document.getElementById('phValue').innerText = data.ph;
    document.getElementById('tdsValue').innerText = data.tds + ' ppm';
    const time = new Date().toLocaleTimeString();
    sensors.forEach(id => {
      const chart = charts[id];
      chart.data.labels.push(time);
      chart.data.datasets[0].data.push(data[id]);
      if (chart.data.labels.length > 10) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
      }
      let message = '', alertType = 'normal', duration = 5000;
      if (data[id] < thresholds[id].min) message = `${id.toUpperCase()} LOW: ${data[id]}`;
      else if (data[id] > thresholds[id].max) message = `${id.toUpperCase()} HIGH: ${data[id]}`;
      if (data[id] < thresholds[id].dangerMin || data[id] > thresholds[id].dangerMax) {
        alertType = 'danger'; duration = 15000;
        message = data[id] < thresholds[id].dangerMin ?
          `${id.toUpperCase()} ⚠️ DANGER LOW: ${data[id]}` :
          `${id.toUpperCase()} ⚠️ DANGER HIGH: ${data[id]}`;
      }
      if (message) showNotification(message, alertType, duration);
      chart.data.datasets[0].borderColor = alertType==='danger' ? 'red' : message ? 'orange' : '#0077ff';
      chart.data.datasets[0].backgroundColor = alertType==='danger' ? 'rgba(255,0,0,0.2)' : message ? 'rgba(255,140,0,0.2)' : 'rgba(0,119,255,0.2)';
      chart.update();
    });
  } catch (e) {
    console.error("Fetch error:", e);
  }
}
setInterval(fetchData, 1500);
