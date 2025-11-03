<%@ Page Language="C#" MasterPageFile="~masterurl/default.master" Inherits="Microsoft.SharePoint.WebPartPages.WebPartPage, Microsoft.SharePoint, Version=15.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c" %>
<%@ Register TagPrefix="SharePoint" Namespace="Microsoft.SharePoint.WebControls" Assembly="Microsoft.SharePoint, Version=15.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c" %>
<asp:Content ContentPlaceHolderID="PlaceHolderMain" runat="server">
  <link href="https://unpkg.com/bootstrap@3.3.7/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    .container { margin-top: 20px; }
    .response { margin-bottom: 20px; padding: 10px; border: 1px solid #ddd; }
  </style>
  <div class="container">
    <h2>Survey Responses</h2>
    <div id="responseList"></div>
  </div>
  <script src="https://unpkg.com/jquery@3.6.0/dist/jquery.min.js"></script>
  <script src="https://unpkg.com/bootstrap@3.3.7/dist/js/bootstrap.min.js"></script>
  <script>
    $(document).ready(function() {
      const urlParams = new URLSearchParams(window.location.search);
      const surveyId = urlParams.get('surveyId');
      if (!surveyId) {
        $('#responseList').html('<div class="alert alert-danger">No survey ID provided.</div>');
        return;
      }

      const ctx = window._spPageContextInfo;
      if (!ctx || !ctx.webAbsoluteUrl) {
        $('#responseList').html('<div class="alert alert-danger">SharePoint context unavailable.</div>');
        return;
      }

      const api = {
        loadSurveyResponses(site, surveyId) {
          const q = `?$select=Id,Title,SurveyJSON,EventTitles,SubmittedBy,SubmitDate&$filter=substringof('${surveyId}', EventTitles)`;
          return $.ajax({
            url: site + "/_api/web/lists/getbytitle('SurveyResponses')/items" + q,
            headers: { Accept: "application/json; odata=verbose" },
            timeout: 15000
          }).then(d => (d.d?.results || []).map(r => ({
            Id: r.Id,
            Title: r.Title,
            SurveyJSON: r.SurveyJSON,
            EventTitles: r.EventTitles,
            SubmittedBy: r.SubmittedBy,
            SubmitDate: r.SubmitDate
          }))).catch(xhr => ({
            error: true,
            message: xhr.responseJSON?.error?.message?.value || "Failed to load responses"
          }));
        }
      };

      api.loadSurveyResponses(ctx.webAbsoluteUrl, surveyId).then(responses => {
        if (responses.error) {
          $('#responseList').html(`<div class="alert alert-danger">${responses.message}</div>`);
          return;
        }
        if (responses.length === 0) {
          $('#responseList').html('<div class="alert alert-info">No responses found.</div>');
          return;
        }
        const html = responses.map(r => {
          const data = JSON.parse(r.SurveyJSON);
          const ratings = Object.keys(data).filter(k => k !== 'eventTitles' && k !== 'comments')
            .map(k => `<p><strong>${k.replace(/_/g, ' ')}:</strong> ${data[k]} stars</p>`).join('');
          const comments = data.comments ? `<p><strong>Comments:</strong> ${data.comments}</p>` : '';
          return `
            <div class="response">
              <h4>${r.Title} (Submitted by ${r.SubmittedBy} on ${new Date(r.SubmitDate).toLocaleString()})</h4>
              ${ratings}
              ${comments}
            </div>
          `;
        }).join('');
        $('#responseList').html(html);
      });
    });
  </script>
</asp:Content>