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


<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
<script>
// Wait for page to load
$(document).ready(function () {
    // Find all table cells that contain numbers with commas
    $('table.ms-formtable td').each(function () {
        var $td = $(this);
        var text = $td.text();

        // Only process if it looks like a number with commas
        if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(text)) {
            var clean = text.replace(/,/g, '');
            $td.text(clean);
        }
    });
});
</script>

<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
<script>
$(document).ready(function () {
    // Target every <td> that contains a field value (skip labels)
    $('table.ms-formtable td').not('.ms-formlabel').each(function () {
        var $cell = $(this);
        var originalText = $cell.text().trim();

        // REGEX: Matches numbers like 1,234,567 | 1234 | 1,234.56 | -1,234
        var numberWithCommas = /^-?\d{1,3}(,\d{3})*(\.\d+)?$/;

        if (numberWithCommas.test(originalText)) {
            var cleanNumber = originalText.replace(/,/g, '');
            $cell.text(cleanNumber);
        }
    });
});
</script>