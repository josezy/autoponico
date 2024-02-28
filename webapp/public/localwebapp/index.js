const fetchConfig = async () => {
    const response = await fetch("/api/config");
    const data = await response.json();
    return data;
};

const updateVariables = (data) => {
    document.getElementById("ec").textContent = data.ec;
    document.getElementById("ph").textContent = data.ph;
    document.getElementById("temperatura").textContent = data.temperatura;
};

window.onload = async () => {
    const config = await fetchConfig();
    document.getElementById("ssid").value = config.ssid;
    document.getElementById("password").value = config.password;
    document.getElementById("ecSetpoint").value = config.ecSetpoint;
    document.getElementById("phSetpoint").value = config.phSetpoint;
    updateVariables(config);

    // Actualizar las variables cada 5 segundos
    setInterval(() => {
        fetch("/api/variables")
            .then((response) => response.json())
            .then((data) => updateVariables(data));
    }, 5000);
};