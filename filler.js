<!-- SurveyJS -->
<link href="https://unpkg.com/survey-core/defaultV2.min.css" rel="stylesheet"/>
<script src="https://unpkg.com/survey-core/survey.core.min.js"></script>
<script src="https://unpkg.com/survey-js-ui/survey-js-ui.min.js"></script>

<div id="app" style="max-width:800px;margin:2rem auto;text-align:center;"></div>

<script type="text/javascript">
/* CONFIG */
const SITE_URL = _spPageContextInfo.webAbsoluteUrl;
const LIST_SURVEYS = 'Surveys';
const LIST_RESPONSES = 'SurveyResponses';
const ID = new URLSearchParams(location.search).get('id');
const STATUS_FIELD = 'Status';
const JSON_FIELD = 'SurveyJSON';

/* UI */
const $ = id => document.getElementById(id);
const set = html => ($('app').innerHTML = html);
const loading = () => set('<p>Loading survey...</p>');
const error = msg => set('<p style="color:red">Error: ' + msg + '</p>');
const draft = () => set('<h3 style="color:#d13438">Draft Mode</h3><p>Survey not available.</p>');

/* GET FORM DIGEST */
function getDigest(callback) {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', SITE_URL + '/_api/contextinfo', true);
    xhr.setRequestHeader('Accept', 'application/json;odata=verbose');
    xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
            const data = JSON.parse(xhr.responseText);
            callback(data.d.GetContextWebInformation.FormDigestValue);
        } else {
            callback(null);
        }
    };
    xhr.send();
}

/* FETCH SURVEY ITEM */
function loadSurvey() {
    if (!ID) return error('Missing ?id=');
    loading();

    const url = `${SITE_URL}/_api/web/lists/GetByTitle('${LIST_SURVEYS}')/items(${ID})?$select=${STATUS_FIELD},${JSON_FIELD}`;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.setRequestHeader('Accept', 'application/json;odata=verbose');
    xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
            const item = JSON.parse(xhr.responseText).d;
            const status = (item[STATUS_FIELD] || '').trim().toLowerCase();

            if (status !== 'published') {
                draft();
                return;
            }

            try {
                const surveyDef = JSON.parse(item[JSON_FIELD]);
                renderSurvey(surveyDef);
            } catch (e) {
                error('Invalid JSON');
            }
        } else {
            error('Load failed');
        }
    };
    xhr.onerror = () => error('Network error');
    xhr.send();
}

/* RENDER SURVEYJS */
function renderSurvey(def) {
    set('<div id="surveyContainer"></div>');
    const survey = new Survey.Model(def);
    Survey.StylesManager.applyTheme("defaultV2");

    survey.onComplete.add(function (sender) {
        alert('Thank you!');
        saveResponse(sender.data);
    });

    survey.render('surveyContainer');
}

/* POST RESPONSE */
function saveResponse(data) {
    getDigest(function (digest) {
        if (!digest) {
            console.error('No digest');
            return;
        }

        const payload = {
            '__metadata': { type: 'SP.Data.SurveyResponsesListItem' },
            'Title': 'Response ' + new Date().toISOString(),
            'SurveyId': ID,
            'ResponseJSON': JSON.stringify(data)
        };

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${SITE_URL}/_api/web/lists/GetByTitle('${LIST_RESPONSES}')/items`, true);
        xhr.setRequestHeader('Accept', 'application/json;odata=verbose');
        xhr.setRequestHeader('Content-Type', 'application/json;odata=verbose');
        xhr.setRequestHeader('X-RequestDigest', digest);
        xhr.onload = function () {
            console.log('Saved:', xhr.status);
        };
        xhr.send(JSON.stringify(payload));
    });
}

/* START */
loadSurvey();
</script>