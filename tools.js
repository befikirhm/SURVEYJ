(function () {
    // Safety: Only override if field exists
    var overrideContext = {};
    overrideContext.Templates = {};
    overrideContext.Templates.Fields = {};

    // === REPLACE 'YourNumberColumn' with your actual Internal Field Name ===
    overrideContext.Templates.Fields["YourNumberColumn"] = {
        "DisplayForm": removeCommasFromField
    };

    // Register only if SPClientTemplates exists
    if (typeof SPClientTemplates !== 'undefined') {
        SPClientTemplates.TemplateManager.RegisterTemplateOverrides(overrideContext);
    }
})();

function removeCommasFromField(ctx) {
    if (!ctx || !ctx.CurrentItem) return "";

    var fieldName = ctx.CurrentFieldSchema.Name;
    var value = ctx.CurrentItem[fieldName];

    // Return empty if no value
    if (!value) return "";

    // Remove commas (thousands separators)
    return value.replace(/,/g, '');
}