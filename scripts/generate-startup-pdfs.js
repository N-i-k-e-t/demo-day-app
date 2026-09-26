/**
 * Startup PDF Report Generator
 * Generates executive-grade, vector PDF reports for each of the 13 Demo Day startups
 * using live database records and the 26 Sep 2026 3:55 PM IST cutoff.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const metricsService = require('../metrics-service');
const pdfGenerator = require('../pdf-generator');

const OUTPUT_DIR = path.join(__dirname, '..', 'exports', 'pdf');
const HTML_TMP_DIR = path.join(__dirname, '..', 'exports', 'tmp_html');

async function generateAllPdfs() {
  console.log('=== DEMO DAY STARTUP-WISE PDF REPORT GENERATOR ===\n');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  if (!fs.existsSync(HTML_TMP_DIR)) {
    fs.mkdirSync(HTML_TMP_DIR, { recursive: true });
  }

  const browserBin = pdfGenerator.getBrowserBinary();
  if (!browserBin) {
    throw new Error('Neither Microsoft Edge nor Google Chrome was found for PDF rendering.');
  }
  console.log(`Using Browser Binary: ${browserBin}`);

  console.log('Fetching live startup metrics from database...');
  const res = await metricsService.getStartupMetrics();
  const startups = res.startups || [];
  const cutoffDisplay = res.cutoff?.display || '26 Sept 2026 • 03:55:00 PM IST';

  console.log(`Found ${startups.length} startups to process. Output directory: ${OUTPUT_DIR}\n`);

  const generatedFiles = [];

  for (const startup of startups) {
    const slug = startup.startupName.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const pitchPadded = String(startup.pitchNumber).padStart(2, '0');
    const filename = `Pitch-${pitchPadded}-${slug}-Report.pdf`;
    const htmlFilename = `Pitch-${pitchPadded}-${slug}.html`;

    const htmlPath = path.join(HTML_TMP_DIR, htmlFilename);
    const pdfPath = path.join(OUTPUT_DIR, filename);

    const htmlContent = pdfGenerator.generateStartupHtml(startup, cutoffDisplay);
    fs.writeFileSync(htmlPath, htmlContent, 'utf8');

    process.stdout.write(`Generating PDF for Pitch #${startup.pitchNumber}: ${startup.startupName}... `);

    // Call browser headless to render PDF
    try {
      execFileSync(browserBin, [
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--run-all-compositor-stages-before-draw',
        '--print-to-pdf-no-header',
        `--print-to-pdf=${pdfPath}`,
        htmlPath
      ], { stdio: 'pipe' });

      const stats = fs.statSync(pdfPath);
      const sizeKb = (stats.size / 1024).toFixed(1);
      console.log(`✓ DONE (${sizeKb} KB) -> ${filename}`);
      generatedFiles.push({
        pitchNumber: startup.pitchNumber,
        startupName: startup.startupName,
        filename,
        path: pdfPath,
        sizeKb
      });
    } catch (err) {
      console.error(`✗ FAILED: ${err.message}`);
    }
  }

  // Also compress into ZIP archive
  try {
    const zipPath = path.join(__dirname, '..', 'exports', 'Demo-Day-All-13-Startup-PDF-Reports.zip');
    execFileSync('powershell', [
      '-Command',
      `Compress-Archive -Path '${OUTPUT_DIR}\\*.pdf' -DestinationPath '${zipPath}' -Force`
    ], { stdio: 'pipe' });
    console.log(`\n📦 Successfully bundled all PDFs into: ${zipPath}`);
  } catch (zErr) {
    console.warn('Warning: Could not create ZIP archive automatically:', zErr.message);
  }

  console.log('\n======================================================');
  console.log(`🎉 Successfully generated ${generatedFiles.length}/${startups.length} Startup PDF Reports!`);
  console.log(`Saved in: ${OUTPUT_DIR}`);
  console.log('======================================================\n');

  return generatedFiles;
}

if (require.main === module) {
  generateAllPdfs()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal error during PDF generation:', err);
      process.exit(1);
    });
}

module.exports = {
  generateAllPdfs
};
