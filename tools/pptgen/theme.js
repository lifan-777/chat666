/**
 * 把主题色写入 pptx 的 ppt/theme/theme1.xml。
 * pptxgenjs 不能直接写主题色，生成后幻灯片中的“主题颜色”(SchemeColor) 会显示为 Office 默认配色，
 * 所以在 writeFile() 之后调用 applyTheme() 替换 <a:clrScheme>。
 */
const fs = require('fs');

const SLOTS = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
const SCHEME_NAMES = ['tx1', 'tx2', 'bg1', 'bg2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'];

function loadJSZip() {
    return require(require.resolve('jszip', { paths: [require.resolve('pptxgenjs')] }));
}

const escapeXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function applyTheme(deckPath, theme) {
    for (const slot of SLOTS) {
        if (!/^[0-9A-Fa-f]{6}$/.test(theme.colors[slot] || '')) {
            throw new Error(`主题色 ${slot} 必须是 6 位十六进制颜色`);
        }
    }
    const JSZip = loadJSZip();
    const zip = await JSZip.loadAsync(fs.readFileSync(deckPath));

    // 主题色名称（如 bg2）只能用于支持主题色的属性；写成 srgbClr 会变成无效颜色
    for (const name of Object.keys(zip.files).filter((n) => /^ppt\/(slides|slideLayouts)\/.*\.xml$/.test(n))) {
        const xml = await zip.file(name).async('string');
        const bad = SCHEME_NAMES.find((s) => xml.includes(`<a:srgbClr val="${s}"`));
        if (bad) throw new Error(`${name} 中把主题色 ${bad} 写成了 RGB 颜色，请在该处改用十六进制颜色`);
    }

    const part = 'ppt/theme/theme1.xml';
    const xml = await zip.file(part).async('string');
    const name = escapeXml(theme.name);
    const scheme = `<a:clrScheme name="${name}">`
        + SLOTS.map((k) => `<a:${k}><a:srgbClr val="${theme.colors[k].toUpperCase()}"/></a:${k}>`).join('')
        + '</a:clrScheme>';
    const out = xml
        .replace(/<a:clrScheme\b[\s\S]*?<\/a:clrScheme>/, () => scheme)
        .replace(/(<a:theme\b[^>]*?\bname=")[^"]*"/, (_, head) => `${head}${name}"`);
    if (!out.includes(scheme)) throw new Error('theme1.xml 中没有找到 <a:clrScheme>');
    zip.file(part, out);
    fs.writeFileSync(deckPath, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
}

module.exports = { applyTheme };
