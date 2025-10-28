<%@ Page Language="C#" %>
<%@ Register Tagprefix="SharePoint" Namespace="Microsoft.SharePoint.WebControls" Assembly="Microsoft.SharePoint, Version=16.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c" %>
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Survey Form Filler</title>

    <!-- SurveyJS CSS & JS (loaded via script tags) -->
    <link href="https://unpkg.com/survey-core/defaultV2.min.css" rel="stylesheet"/>
    <script src="https://unpkg.com/survey-core/survey.core.min.js"></script>
    <script src="https://unpkg.com/survey-js-ui/survey-js-ui.min.js"></script>

    <!-- SharePoint 2016 core (for _spPageContextInfo) -->
    <SharePoint:ScriptLink language="javascript" name="sp.js" OnDemand="true" LoadAfterUI="true" Localizable="false" runat="server"/>

    <!-- Custom Styles -->
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background: #f3f2f1; }
        #surveyApp {
            max-width: 800px;
            margin: 2rem auto;
            padding: 1rem;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .loading, .error { text-align: center; padding: 2rem; color: #666; }
        .error { color: #a80000; }
        .draft-mode {
            text-align: center;
            padding: 3rem 2rem;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border: 1px solid #d0d0d0;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            color: #323130;
        }
        .draft-mode h2 {
            color: #d13438;
            font-size: 1.8rem;
            margin-bottom: 0.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
        }
        .draft-mode p {
            font-size: 1.1rem;
            margin: 0 0 0.5rem 0;
            color: #605e5c;
        }
        .draft-icon { font-size: 2rem; }
        @media (max-width: 600px) {
            .draft-mode { padding: 2rem 1rem; }
            .draft-mode h2 { font-size: 1.5rem; }
        }
    </style>
</head>
<body>

<div id="surveyApp">
    <p>Loading survey...</p>
</div>

<script type="text/javascript">
/* CONFIG */
const SITE_URL = _spPageContextInfo.webAbsoluteUrl;
const LIST_SURVEYS = 'Surveys';
const LIST_RESPONSES = 'SurveyResponses';  // Optional: for saving responses
const ID = new URLSearchParams(location.search).get('id');
const STATUS_FIELD = 'Status';
const JSON_FIELD = 'SurveyJSON';

/* UI HELPERS */
const app = document.getElementById('surveyApp');
if (!app) { throw new Error('#surveyApp missing'); }
const setHTML = html => app.innerHTML = html;
const showLoading = () => setHTML('<p style="text-align:center;padding:2rem;color:#666;">Loading survey...</p>');
const showError = msg => setHTML(`<p style="text-align:center;padding:2rem;color:#a80000;">Error: ${msg}</p>`);
const showDraft = () => setHTML(`
    <div class="draft-mode">
        <h2><span class="draft-icon">📝</span>Draft Mode</h2>
        <p>This survey is currently in <strong>Draft</strong> and not available for submission.</p>
        <p><small>Contact the administrator if you believe this is an error.</small></p>
    </div>
`);

/* FETCH SURVEY ITEM */
function getSurveyModel() {
    if (!ID) return showError('Missing ?id= in URL');
    showLoading();

    fetch(`${SITE_URL}/_api/web/lists/GetByTitle('${LIST_SURVEYS}')/items(${ID})?$select=${STATUS_FIELD},${JSON_FIELD}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json;odata=verbose' },
        credentials: 'include'
    })
    .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    })
    .then(data => {
        const item = data.d;
        if (!item) throw new Error('Survey not found');
        const status = (item[STATUS_FIELD] || '').trim().toLowerCase();
        const jsonStr = item[JSON_FIELD];

        // Check status and render
        if (status !== 'published') {
            showDraft();
            return;
        }

        let surveyDef;
        try {
            surveyDef = JSON.parse(jsonStr);
        } catch (e) {
            showError('Invalid survey JSON');
            return;
        }

        renderSurvey(surveyDef);
    })
    .catch(err => {
        console.error(err);
        showError('Failed to load survey: ' + err.message);
    });
}

/* RENDER SURVEYJS */
function renderSurvey(surveyJson) {
    setHTML('<div id="surveyContainer" style="max-width:800px;margin:0 auto;"></div>');

    const survey = new Survey.Model(surveyJson);
    Survey.StylesManager.applyTheme("defaultV2");

    survey.onComplete.add(sender => {
        alert('Thank you! Your response has been recorded.');
        saveResponse(sender.data);  // Optional: save to list
    });

    survey.render('surveyContainer');
}

/* OPTIONAL: SAVE RESPONSE */
function saveResponse(data) {
    // Get form digest first
    fetch(`${SITE_URL}/_api/contextinfo`, {
        method: 'POST',
        headers: { 'Accept': 'application/json;odata=verbose' },
        credentials: 'include'
    })
    .then(r => r.json())
    .then(ctx => {
        const digest = ctx.d.GetContextWebInformation.FormDigestValue;
        const payload = {
            '__metadata': { type: 'SP.Data.SurveyResponsesListItem' },
            'Title': 'Response ' + new Date().toISOString(),
            'SurveyId': ID,
            'ResponseJSON': JSON.stringify(data)
        };

        fetch(`${SITE_URL}/_api/web/lists/GetByTitle('${LIST_RESPONSES}')/items`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json;odata=verbose',
                'Content-Type': 'application/json;odata=verbose',
                'X-RequestDigest': digest
            },
            body: JSON.stringify(payload),
            credentials: 'include'
        })
        .then(r => console.log('Saved:', r.ok ? 'Success' : 'Failed'))
        .catch(e => console.error('Save failed:', e));
    })
    .catch(e => console.error('Digest failed:', e));
}

/* START ON DOM READY */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', getSurveyModel);
} else {
    getSurveyModel();
}
</script>

</body>
</html>