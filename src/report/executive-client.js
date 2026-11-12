// Browser code of the executive report. The report page defines pagesData, BAND_DATA, IMG_DATA and CSV_NAME before this runs.
// This file is read as text and placed in the page; it is not loaded by the server.

// Populate Pages Table
function renderPagesTable(data) {
  const tbody = document.getElementById("pagesTableBody");
  tbody.innerHTML = "";

  data.forEach(item => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition border-b border-slate-100";

    const typeBadge = {
      "location-service": "bg-sky-50 text-sky-700 border-sky-200",
      "service": "bg-purple-50 text-purple-700 border-purple-200",
      "location-hub": "bg-indigo-50 text-indigo-700 border-indigo-200",
      "utility": "bg-slate-100 text-slate-700 border-slate-200",
      "home": "bg-emerald-50 text-emerald-700 border-emerald-200",
      "location": "bg-cyan-50 text-cyan-700 border-cyan-200",
      "blog": "bg-amber-50 text-amber-700 border-amber-200",
      "product": "bg-rose-50 text-rose-700 border-rose-200",
      "portfolio": "bg-orange-50 text-orange-700 border-orange-200",
      "gallery": "bg-pink-50 text-pink-700 border-pink-200",
      "faq": "bg-teal-50 text-teal-700 border-teal-200",
      "about": "bg-lime-50 text-lime-700 border-lime-200",
      "contact": "bg-slate-100 text-slate-700 border-slate-200",
    }[item.type] || "bg-slate-50 text-slate-600";

    const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    tr.innerHTML = `
      <td class="py-3 px-5 font-mono text-slate-900 font-semibold">${esc(item.path)}</td>
      <td class="py-3 px-3"><span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${typeBadge}">${esc(item.type)}</span></td>
      <td class="py-3 px-3 text-slate-500 font-mono text-[11px]">${esc(item.mode)}</td>
      <td class="py-3 px-3 text-center font-mono text-slate-400 font-medium">${item.before}</td>
      <td class="py-3 px-3 text-center font-mono font-black text-brand-600 text-sm">${item.after}</td>
      <td class="py-3 px-3 text-center font-mono ${item.change < 0 ? "text-rose-600 bg-rose-50/50" : "text-emerald-600 bg-emerald-50/50"} font-extrabold rounded">${item.change > 0 ? "+" : ""}${item.change}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("pageCountDisplay").innerText = `Showing ${data.length} of ${pagesData.length} verified pages`;
}

// Filter Logic
function filterPagesTable() {
  const search = document.getElementById("pageSearchInput").value.toLowerCase();
  const type = document.getElementById("typeFilter").value;
  const status = document.getElementById("statusFilter").value;

  const filtered = pagesData.filter(item => {
    const matchesSearch = item.path.toLowerCase().includes(search) || item.title.toLowerCase().includes(search);
    const matchesType = !type || item.type === type;

    let matchesStatus = true;
    if (status === "100") matchesStatus = item.after === 100;
    if (status === "gain20") matchesStatus = item.change >= 20;
    if (status === "gain15") matchesStatus = item.change >= 15;

    return matchesSearch && matchesType && matchesStatus;
  });

  renderPagesTable(filtered);
}

// CSV export of every page
function exportPagesCSV() {
  const q = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const lines = ["Page Path,Type,Mode,Score Before,Score After,Change,Original Title,New Title"];
  pagesData.forEach(e => {
    lines.push([q(e.path), q(e.type), q(e.mode), e.before, e.after, e.change, q(e.title), q(e.newTitle)].join(","));
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
  link.download = CSV_NAME;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Initialize Charts on Window Load
window.onload = function() {
  renderPagesTable(pagesData);

  // Score Bands Chart
  new Chart(document.getElementById('scoreBandsChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['10-39 (F)', '40-69 (D)', '70-79 (C)', '80-89 (B)', '90-100 (A+)'],
      datasets: [
        { label: 'Original Pages', data: BAND_DATA.before, backgroundColor: '#cbd5e1', borderRadius: 6 },
        { label: 'Modernized 2026', data: BAND_DATA.after, backgroundColor: '#0284c7', borderRadius: 6 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: 'Plus Jakarta Sans', size: 11, weight: 'bold' } } },
        tooltip: { cornerRadius: 8 }
      },
      scales: {
        y: { grid: { color: '#f1f5f9' }, ticks: { font: { family: 'Fira Code', size: 10 } } },
        x: { grid: { display: false }, ticks: { font: { family: 'Plus Jakarta Sans', size: 11, weight: 'bold' } } }
      }
    }
  });

  // Image Actions Donut Chart
  new Chart(document.getElementById('imageActionsChart').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Converted to WebP', 'Recompressed', 'Kept Untouched'],
      datasets: [{ data: IMG_DATA, backgroundColor: ['#0284c7', '#f97316', '#94a3b8'], borderWidth: 3, borderColor: '#ffffff' }]
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false }, tooltip: { cornerRadius: 8 } } }
  });
};

// Search box and result filter of the image result list
function filterImageRows() {
  const q = document.getElementById("imageSearchInput").value.toLowerCase();
  const status = document.getElementById("imageResultFilter").value;
  let shown = 0;
  const rows = document.querySelectorAll("#imageTable tbody tr");
  rows.forEach((r) => {
    const hit = (!q || r.dataset.row.includes(q)) && (!status || r.dataset.status === status);
    r.style.display = hit ? "" : "none";
    if (hit) shown += 1;
  });
  document.getElementById("imageCount").innerText = `Showing ${shown} of ${rows.length} images`;
}

// CSV export of the images currently shown (all of them when no filter is set)
function exportImagesCSV() {
  const q = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const lines = ["Filename,Result,Before size (bytes),After size (bytes),Saved %"];
  document.querySelectorAll("#imageTable tbody tr").forEach((r) => {
    if (r.style.display === "none") return;
    const d = r.dataset;
    lines.push([q(d.name), q(d.label), d.before, d.after, d.saved].join(","));
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
  link.download = CSV_NAME.replace("_modernisation_audit_", "_image_optimisation_").replace(/_\d+_pages\.csv$/, ".csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
