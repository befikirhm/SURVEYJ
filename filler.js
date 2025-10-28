<!-- SurveyJS (loaded by <script>) -->
<link href="https://unpkg.com/survey-core/defaultV2.min.css" rel="stylesheet"/>
<script src="https://unpkg.com/survey-core/survey.core.min.js"></script>
<script src="https://unpkg.com/survey-js-ui/survey-js-ui.min.js"></script>

<!-- SP 2016 core -->
<SharePoint:ScriptLink name="sp.runtime.js" OnDemand="true" runat="server"/>
<SharePoint:ScriptLink name="sp.js" OnDemand="true" runat="server"/>

<div id="surveyApp" style="max-width:800px;margin:2rem auto;text-align:center;"></div>

<script type="text/javascript">
/* CONFIG */
const LIST = 'Surveys', STATUS = 'Status', JSON = 'SurveyJSON';
const ID = new URLSearchParams(location.search).get('id');

/* UI */
const $ = id => document.getElementById(id);
const set = html => $('surveyApp').innerHTML = html;
const loading = () => set('<p>Loading...</p>');
const error = msg => set(`<p style="color:red">Error: ${msg}</p>`);
const draft = () => set('<h3 style="color:#d13438">Draft Mode</h3><p>Not available.</p>');

/* FETCH ITEM */
function load() {
    if (!ID) return error('Missing ?id=');
    loading();

    SP.SOD.executeFunc('sp.js', 'SP.ClientContext', () => {
        const ctx = SP.ClientContext.get_current();
        const exec = new SP.RequestExecutor(ctx.get_url());
        const url = `${ctx.get_url()}/_api/web/lists/GetByTitle('${LIST}')/items(${ID})?$select=${STATUS},${JSON}`;

        exec.executeAsync({
            url, method: 'GET',
            headers: { 'Accept': 'application/json;odata=verbose' },
            success: data => {
                const item = JSON.parse(data.body).d;
                if ((item[STATUS] || '').trim().toLowerCase() !== 'published') return draft();
                try { renderSurvey(JSON.parse(item[JSON])); }
                catch { error('Invalid JSON'); }
            },
            error: err => error((JSON.parse(err.body)?.error?.message?.value) || 'Load failed')
        });
    });
}

/* RENDER SURVEYJS */
function renderSurvey(def) {
    set('<div id="surveyContainer"></div>');
    const survey = new Survey.Model(def);
    Survey.StylesManager.applyTheme("defaultV2");
    survey.onComplete.add(s => alert('Submitted!'));
    survey.render('surveyContainer');
}

/* START */
ExecuteOrDelayUntilScriptLoaded(load, 'sp.js');
