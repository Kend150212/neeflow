const fs = require('fs');
const si = require('simple-icons');

const dir = './public/logos';
fs.mkdirSync(dir, { recursive: true });

const icons = [
    ['siShopify', 'shopify'],
    ['siWordpress', 'wordpress'],
    ['siWoocommerce', 'woocommerce'],
    ['siEtsy', 'etsy'],
    ['siHubspot', 'hubspot'],
    ['siGooglesheets', 'google-sheets'],
    ['siAirtable', 'airtable'],
    ['siZapier', 'zapier'],
    ['siGoogledrive', 'google-drive'],
    ['siSalesforce', 'salesforce'],
];

icons.forEach(([key, name]) => {
    const icon = si[key];
    if (!icon) {
        console.log('MISSING:', key);
        return;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#${icon.hex}"><path d="${icon.path}"/></svg>`;
    fs.writeFileSync(`${dir}/${name}.svg`, svg);
    console.log(`OK: ${name} (#${icon.hex})`);
});
