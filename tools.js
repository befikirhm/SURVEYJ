(function () {
    // Only run if SharePoint client templates are loaded
    if (typeof SPClientTemplates === 'undefined') return;

    var ctx = {};
    ctx.Templates = {};
    ctx.Templates.Fields = {};

    // === CHANGE THIS TO YOUR INTERNAL COLUMN NAME ===
    ctx.Templates.Fields["Budget"] = { "DisplayForm": removeCommas };

    SPClientTemplates.TemplateManager.RegisterTemplateOverrides(ctx);
})();

function removeCommas(fieldCtx) {
    if (!fieldCtx || !fieldCtx.CurrentItem) return "";

    var value = fieldCtx.CurrentItem[fieldCtx.CurrentFieldSchema.Name];
    if (!value) return "";

    // Remove commas and return clean number
    return value.replace(/,/g, '');
}