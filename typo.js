console.log("connected typo")


const startTitle = document.querySelector(".title");
const distanceReadout = document.querySelector(".distance");

// Size text by the ink of its glyphs (not the line box), so the visible
// characters touch the edges of the element and sit exactly in its center.
// Each character gets its own span so the gaps between glyphs can be closed.
const glyphMeasureContext = document.createElement("canvas").getContext("2d");

function splitIntoGlyphs(element, text){
    const chars = [...text];
    const alreadySplit = element.childNodes.length === chars.length
        && [...element.childNodes].every((node, i) =>
            node.nodeType === Node.ELEMENT_NODE && node.textContent === chars[i]);
    if (alreadySplit) return [...element.children];

    const glyphs = chars.map((char) => {
        const glyph = document.createElement("span");
        glyph.className = "glyph";
        glyph.textContent = char;
        return glyph;
    });
    element.replaceChildren(...glyphs);
    return glyphs;
}

async function fitGlyphsToBox(element){
    await document.fonts.ready;

    const text = element.textContent.trim();
    if (text === "") return;
    const glyphs = splitIntoGlyphs(element, text);

    // Padding is only used below to offset the text, so measure without it
    element.style.padding = "0";
    const styles = getComputedStyle(element);
    const availableWidth = element.clientWidth;
    const availableHeight = element.clientHeight;
    if (availableWidth <= 0 || availableHeight <= 0) return;

    const baseFontSize = 100;
    glyphMeasureContext.font = `${styles.fontWeight} ${baseFontSize}px ${styles.fontFamily}`;
    const glyphMetrics = glyphs.map((glyph) => glyphMeasureContext.measureText(glyph.textContent));

    // Size from all digits, not just the current ones, so the font size and
    // baseline only change with the number of characters, not with every value
    const referenceMetrics = [...new Set([..."0123456789", ...text])]
        .map((char) => glyphMeasureContext.measureText(char));
    const widestInk = Math.max(...referenceMetrics.map((metrics) =>
        metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight));
    const referenceAscent = Math.max(...referenceMetrics.map((metrics) => metrics.actualBoundingBoxAscent));
    const referenceDescent = Math.max(...referenceMetrics.map((metrics) => metrics.actualBoundingBoxDescent));

    // gap = space between the ink of one glyph and the ink of the next
    const gaps = glyphMetrics.slice(0, -1).map((metrics, i) =>
        metrics.width - metrics.actualBoundingBoxRight - glyphMetrics[i + 1].actualBoundingBoxLeft
    );
    const first = glyphMetrics[0];
    const last = glyphMetrics[glyphMetrics.length - 1];
    const rowWidth = glyphMetrics.reduce((sum, metrics) => sum + metrics.width, 0)
        - gaps.reduce((sum, gap) => sum + gap, 0);
    const inkStart = -first.actualBoundingBoxLeft;
    const inkEnd = rowWidth - last.width + last.actualBoundingBoxRight;
    const inkWidth = inkEnd - inkStart;
    const worstCaseWidth = widestInk * glyphs.length;
    const inkHeight = referenceAscent + referenceDescent;
    if (inkWidth <= 0 || inkHeight <= 0) return;

    const scale = Math.min(availableWidth / worstCaseWidth, availableHeight / inkHeight);
    const fontSize = baseFontSize * scale;

    // The flex container centers the row of advances and the line box;
    // shift by the difference between those centers and the ink center
    const fontAscent = first.fontBoundingBoxAscent;
    const fontDescent = first.fontBoundingBoxDescent;
    const shiftX = (rowWidth / 2 - (inkStart + inkEnd) / 2) * scale;
    const shiftY = ((referenceAscent - referenceDescent) / 2 - (fontAscent - fontDescent) / 2) * scale;

    glyphs.forEach((glyph, i) => {
        glyph.style.marginRight = i < gaps.length ? `${-gaps[i] * scale}px` : "";
    });

    // Padding on one side moves the centered text by half its size
    element.style.fontSize = `${fontSize}px`;
    element.style.paddingLeft = `${Math.max(0, shiftX * 2)}px`;
    element.style.paddingRight = `${Math.max(0, -shiftX * 2)}px`;
    element.style.paddingTop = `${Math.max(0, shiftY * 2)}px`;
    element.style.paddingBottom = `${Math.max(0, -shiftY * 2)}px`;
}

// Font size (px) at which the ink of `text` exactly fills `element`
// at the given weight, including the element's letter-spacing
function fillFontSize(element, text, weight){
    const styles = getComputedStyle(element);
    const baseFontSize = 100;
    glyphMeasureContext.font = `${weight} ${baseFontSize}px ${styles.fontFamily}`;
    const metrics = glyphMeasureContext.measureText(text);
    const letterSpacingEm = (parseFloat(styles.letterSpacing) || 0) / parseFloat(styles.fontSize);
    const inkWidth = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight
        + letterSpacingEm * baseFontSize * ([...text].length - 1);
    const inkHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    if (inkWidth <= 0 || inkHeight <= 0) return null;

    return baseFontSize * Math.min(
        element.clientWidth / inkWidth,
        element.clientHeight / inkHeight
    );
}

// Start title: the font size is fixed so the ink fills the height (or the
// width, if that runs out first) at every weight the title animates through.
// Letter-spacing then stretches the ink to the full width, recomputed every
// frame because the glyphs get narrower as the weight animates down
const startTitleWeights = [50, 140]; // see start-weight in styles.css
let startTitleFit = null;

async function fitStartTitleSize(){
    await document.fonts.ready;

    const text = startTitle.textContent.trim();
    const availableWidth = startTitle.clientWidth;
    const availableHeight = startTitle.clientHeight;
    startTitleFit = null;
    if (text === "" || availableWidth <= 0 || availableHeight <= 0) return;

    const fontFamily = getComputedStyle(startTitle).fontFamily;
    const allMetrics = startTitleWeights.map((weight) =>
        measureInk(text, weight, fontFamily));
    const inkWidth = Math.max(...allMetrics.map((metrics) =>
        metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight));
    const inkAscent = Math.max(...allMetrics.map((metrics) => metrics.actualBoundingBoxAscent));
    const inkDescent = Math.max(...allMetrics.map((metrics) => metrics.actualBoundingBoxDescent));
    const inkHeight = inkAscent + inkDescent;
    if (inkWidth <= 0 || inkHeight <= 0) return;

    const scale = Math.min(availableWidth / inkWidth, availableHeight / inkHeight);

    // The grid centers the line box; shift by the difference between
    // its center and the ink center
    const fontAscent = allMetrics[0].fontBoundingBoxAscent;
    const fontDescent = allMetrics[0].fontBoundingBoxDescent;
    const shiftY = ((inkAscent - inkDescent) / 2 - (fontAscent - fontDescent) / 2) * scale;

    startTitle.style.fontSize = `${baseInkFontSize * scale}px`;
    startTitle.style.paddingTop = `${Math.max(0, shiftY * 2)}px`;
    startTitle.style.paddingBottom = `${Math.max(0, -shiftY * 2)}px`;
    startTitleFit = { text, fontFamily, scale, availableWidth };
    updateStartTitleSpacing();
}

function updateStartTitleSpacing(){
    if (!startTitleFit) return;
    const { text, fontFamily, scale, availableWidth } = startTitleFit;
    const characterCount = [...text].length;
    if (characterCount < 2) return;

    const metrics = measureInk(text, getComputedStyle(startTitle).fontWeight, fontFamily);
    const inkWidth = (metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight) * scale;
    const letterSpacing = (availableWidth - inkWidth) / (characterCount - 1);

    // Letter-spacing is also added after the last glyph, so the centered
    // advance box is one spacing wider than the ink needs; shift that out too
    const shiftX = ((metrics.width - metrics.actualBoundingBoxRight + metrics.actualBoundingBoxLeft) * scale
        + letterSpacing) / 2;

    // Padding on one side moves the centered text by half its size
    startTitle.style.letterSpacing = `${letterSpacing}px`;
    startTitle.style.paddingLeft = `${Math.max(0, shiftX * 2)}px`;
    startTitle.style.paddingRight = `${Math.max(0, -shiftX * 2)}px`;
}

const baseInkFontSize = 100;

function measureInk(text, weight, fontFamily){
    glyphMeasureContext.font = `${weight} ${baseInkFontSize}px ${fontFamily}`;
    return glyphMeasureContext.measureText(text);
}

function trackStartTitleWeight(){
    updateStartTitleSpacing();
    requestAnimationFrame(trackStartTitleWeight);
}

function scheduleFit(fit){
    let frame = null;
    return () => {
        if (frame !== null) return;
        frame = requestAnimationFrame(() => {
            frame = null;
            fit();
        });
    };
}

const fitStartTitle = scheduleFit(fitStartTitleSize);
// Fit right away (not on the next frame) so a new value is never painted unfitted
const fitDistanceReadout = () => fitGlyphsToBox(distanceReadout);

distanceReadout.addEventListener("distanceweightchange", fitDistanceReadout);
// Border box: the padding set by the fit must not trigger another fit
new ResizeObserver(fitStartTitle).observe(startTitle, { box: "border-box" });
new ResizeObserver(fitDistanceReadout).observe(distanceReadout);
new MutationObserver(fitDistanceReadout).observe(distanceReadout, {
    childList: true,
    characterData: true,
    subtree: true
});
fitStartTitle();
trackStartTitleWeight();
fitDistanceReadout();
