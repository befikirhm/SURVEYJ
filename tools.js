// == RemoveCommas.js ==
// Works ONLY on DisplayForm, never breaks the form
(function () {
    // Safety: exit if SharePoint client-templates are not loaded
    if (typeof SPClientTemplates === 'undefined') return;

    var override = {};
    override.Templates = {};
    override.Templates.Fields = {};

    // ---- CHANGE THIS TO YOUR INTERNAL COLUMN NAME ----
    var internalName = "Budget";      // <-- EDIT THIS LINE ONLY
    // --------------------------------------------------

    override.Templates.Fields[internalName] = {
        "DisplayForm": removeCommas
    };

    SPClientTemplates.TemplateManager.RegisterTemplateOverrides(override);
})();

function removeCommas(ctx) {
    // ctx is always passed by Shareengine – never null in DisplayForm
    var raw = ctx.CurrentItem[ctx.CurrentFieldSchema.Name];
    return (raw == null) ? "" : raw.replace(/,/g, "");
}