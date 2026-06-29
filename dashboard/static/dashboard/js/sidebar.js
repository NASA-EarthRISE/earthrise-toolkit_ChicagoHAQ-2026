// ────── Sidebar Open and Close ──────//
const sidebar = document.getElementById("sidebar");
const togglebtn = document.getElementById("togglebtn");
togglebtn.addEventListener("click", () => { sidebar.classList.toggle("collapsed");
  })