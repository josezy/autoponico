const fetchConfig = async () => {
  const response = await fetch("/readConfig");
  const data = await response.json();
  return data;
};

const updateVariables = (data) => {
  document.getElementById("EC_READING").textContent = data.EC_READING;
  document.getElementById("PH_READING").textContent = data.PH_READING;
};

const onRangeChange = (labelId, prefixText, value) => {
  const secondsLabel =  parseInt(value) === 1 ? "segundo" : "segundos";
  document.getElementById(labelId).textContent = `${prefixText} ${value} ${secondsLabel}`;
};

window.onload = async () => {
  const config = await fetchConfig();
  document.getElementById("WIFI_SSID").value = config.WIFI_SSID;
  document.getElementById("WIFI_PASSWORD").value = config.WIFI_PASSWORD;
  document.getElementById("EC_SETPOINT").value = config.EC_SETPOINT;
  document.getElementById("PH_SETPOINT").value = config.PH_SETPOINT;
  updateVariables(config);

  // Actualizar las variables cada 5 segundos
  setInterval(() => {
    fetch("/readSensorData")
      .then((response) => response.json())
      .then((data) => updateVariables(data));
  }, 5000);
};
