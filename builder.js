// builder.aspx – GET FORM BY GUID
function getQueryParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

function loadFormByGUID() {
  const guid = getQueryParam('surveyId');
  if (!guid) {
    alert('No surveyId provided');
    return;
  }

  // CASE 1: If it's a GUID (36 chars, has dashes)
  if (guid.length === 36 && guid.includes('-')) {
    fetchFormByGUID(guid);
  } 
  // CASE 2: Fallback to integer ID (legacy)
  else if (!isNaN(guid)) {
    fetchFormById(guid);
  }
  else {
    alert('Invalid surveyId');
  }
}

function fetchFormByGUID(guid) {
  const listUrl = _spPageContextInfo.webAbsoluteUrl + "/_api/web/lists/getbytitle('Surveys')/items";
  const filter = `?$filter=FormGUID eq '${guid}'&$select=Id,Title,surveyData,Owners/Id,StartDate,EndDate,Status&$expand=Owners`;

  $.ajax({
    url: listUrl + filter,
    method: 'GET',
    headers: { 'Accept': 'application/json; odata=verbose' },
    xhrFields: { withCredentials: true }
  })
  .done(data => {
    if (data.d.results.length === 0) {
      alert('Form not found or access denied');
      return;
    }
    const item = data.d.results[0];
    loadFormIntoBuilder(item); // ← Your existing function
  })
  .fail(() => alert('Failed to load form'));
}

function fetchFormById(id) {
  // Your old code (keep for backward compatibility)
  const url = _spPageContextInfo.webAbsoluteUrl + `/_api/web/lists/getbytitle('Surveys')/items(${id})?$select=Id,Title,surveyData,Owners/Id,StartDate,EndDate,Status&$expand=Owners`;
  $.ajax({ url, method: 'GET', headers: { 'Accept': 'application/json; odata=verbose' }, xhrFields: { withCredentials: true } })
    .done(d => loadFormIntoBuilder(d.d))
    .fail(() => alert('Failed to load form'));
}

// CALL ON PAGE LOAD
$(document).ready(() => {
  loadFormByGUID();
});