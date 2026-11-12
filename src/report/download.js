// "Download as HTML": the report saves itself as one .html file.
// The page asks for its own file again (so the copy is exactly what was generated, without the filters and sorting of this visit);
// opened straight from a folder that is not possible, so the page as it is shown is saved instead.
const TITLE = 'Save this report as one HTML file you can email or open anywhere';
const ICON = '<i class="ph ph-download-simple"></i>';

// the button of a newly generated report: same classes as the Print button next to it
export const DOWNLOAD_BUTTON = (cls) => `<button type="button" id="dl-html-btn" onclick="downloadReportHtml()" class="${cls}" title="${TITLE}">${ICON}<span class="hidden 2xl:inline">Download as HTML</span></button>`;

export const DOWNLOAD_SCRIPT = `<script>
async function downloadReportHtml() {
  var html = '';
  try { var r = await fetch(location.href.split('#')[0], { cache: 'no-store' }); if (r.ok) html = await r.text(); } catch (e) { html = ''; }
  if (!html || html.indexOf('<html') < 0) html = '<!DOCTYPE html>' + String.fromCharCode(10) + document.documentElement.outerHTML;
  var name = (document.title || 'modernization-report').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'modernization-report';
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  a.download = name + '.html';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
}
</script>`;

// A report made before the button existed is a saved file without it. It gets the button next to its Print button, in the same style,
// and the print layout that fits every column and row on the page, so nothing has to be generated again.
const PRINT_FIX = `<style id="print-fix">
@page { size: A4 landscape; margin: 10mm; }
#dl-html-float { position: fixed; right: 16px; bottom: 16px; z-index: 99999; font: 600 13px system-ui, sans-serif; background: #0f766e; color: #fff; border: 0; border-radius: 999px; padding: 9px 16px; cursor: pointer; box-shadow: 0 6px 18px rgba(0,0,0,.25); }
@media print {
  #dl-html-float, #dl-html-btn { display: none !important; }
  .overflow-x-auto, .overflow-auto, .overflow-hidden, .custom-scrollbar, .scroll { overflow: visible !important; max-height: none !important; }
  table { width: 100% !important; min-width: 0 !important; font-size: 7.5pt !important; }
  th, td { white-space: normal !important; max-width: none !important; min-width: 0 !important; overflow-wrap: anywhere; word-break: break-word; padding: 3px 4px !important; }
  th, .sticky { position: static !important; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  tr.more { display: table-row !important; }
}
</style>`;

// every saved report of every website that does not have the button yet (or has the earlier floating one) is rewritten; a report that has it is left alone
export async function upgradeSavedReports(reportFiles) {
  const fsp = await import('node:fs/promises');
  const done = [];
  for (const file of reportFiles) {
    try {
      const html = await fsp.readFile(file, 'utf8');
      const next = withDownloadButton(html);
      if (next === html) continue;
      await fsp.writeFile(file + '.tmp', next);
      await fsp.rename(file + '.tmp', file);
      done.push(file);
    } catch { /* no report there, or it is open elsewhere: the portal still adds the button when it opens it */ }
  }
  return done;
}

export function withDownloadButton(source) {
  // the first toolbar version showed the label one size earlier than the Print button: same size now
  let html = String(source).split('hidden xl:inline">Download as HTML').join('hidden 2xl:inline">Download as HTML');
  // the first version put a floating button over the page: take it out before adding the one in the toolbar
  if (html.includes('dl-html-float')) {
    html = html.replace(/<style id="print-fix">[\s\S]*?<\/style>/, '').replace(/<button[^>]*id="dl-html-float"[^>]*>[\s\S]*?<\/button>/, '').replace(/<script>\s*async function downloadReportHtml\(\)[\s\S]*?<\/script>/, '');
  }
  // what the page already has: the button, the function behind it, the print layout (each is added only when it is missing)
  const hasButton = html.includes('onclick="downloadReportHtml()"');
  const hasScript = html.includes('async function downloadReportHtml');
  const hasPrintFix = html.includes('id="print-fix"') || html.includes('tables: no scrolling box') || html.includes('font-size:8pt}th,td');
  if (hasButton && hasScript && hasPrintFix) return html === String(source) ? source : html;
  let add = '';
  if (!hasPrintFix) add += PRINT_FIX;
  if (!hasButton) {
    // beside the Print button, with its classes
    const print = /<button[^>]*onclick="window\.print\(\)"[^>]*>/i.exec(html);
    if (print) {
      const cls = (/class="([^"]*)"/i.exec(print[0]) || [])[1] || '';
      const inner = html.slice(print.index + print[0].length, html.indexOf('</button>', print.index));
      const button = `<button type="button" id="dl-html-btn" onclick="downloadReportHtml()" class="${cls}" title="${TITLE}">${/<i class="ph/.test(inner) ? `${ICON}<span class="hidden 2xl:inline">Download as HTML</span>` : 'Download as HTML'}</button>`;
      html = html.slice(0, print.index) + button + html.slice(print.index);
    } else add += `<button type="button" id="dl-html-float" onclick="downloadReportHtml()" title="${TITLE}">Download as HTML</button>`;
  }
  if (!hasScript) add += DOWNLOAD_SCRIPT;
  if (!add) return html;
  const end = html.toLowerCase().lastIndexOf('</body>');
  return end >= 0 ? html.slice(0, end) + add + html.slice(end) : html + add;
}
