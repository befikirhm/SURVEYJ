<%@ Page Language="C#" MasterPageFile="~masterurl/default.master" Inherits="Microsoft.SharePoint.WebPartPages.WebPartPage, Microsoft.SharePoint, Version=15.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c" %>
<%@ Register TagPrefix="SharePoint" Namespace="Microsoft.SharePoint.WebControls" Assembly="Microsoft.SharePoint, Version=15.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c" %>
<asp:Content ContentPlaceHolderID="PlaceHolderMain" runat="server">
  <link href="https://unpkg.com/bootstrap@3.3.7/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://unpkg.com/survey-core/defaultV2.min.css" rel="stylesheet">
  <style>
    .container { margin-top: 20px; }
  </style>
  <div class="container">
    <h2>Event Feedback Survey</h2>
    <div id="surveyElement"></div>
  </div>
  <script src="https://unpkg.com/jquery@3.6.0/dist/jquery.min.js"></script>
  <script src="https://unpkg.com/bootstrap@3.3.7/dist/js/bootstrap.min.js"></script>
  <script src="https://unpkg.com/survey-core/survey.core.min.js"></script>
  <script src="https://unpkg.com/survey-knockout/survey.min.js"></script>
  <script>
    $(document).ready(function() {
      const urlParams = new URLSearchParams(window.location.search);
      const surveyId = urlParams.get('surveyId');
      if (!surveyId) {
        $('#surveyElement').html('<div class="alert alert-danger">No survey ID provided.</div>');
        return;
      }

      const ctx = window._spPageContextInfo;
      if (!ctx || !ctx.webAbsoluteUrl) {
        $('#surveyElement').html('<div class="alert alert-danger">SharePoint context unavailable.</div>');
        return;
      }

      const api = {
        loadEvents(site) {
          const q = "?$select=Title";
          return $.ajax({
            url: site + "/_api/web/lists/getbytitle('Events')/items" + q,
            headers: { Accept: "application/json; odata=verbose" },
            timeout: 15000
          }).then(d => (d.d?.results || []).map(e => e.Title));
        },
        saveSurveyResponse(site, digest, responseData) {
          return $.ajax({
            url: site + "/_api/web/lists/getbytitle('SurveyResponses')/items",
            type: "POST",
            data: JSON.stringify({
              '__metadata': { type: 'SP.Data.SurveyResponsesListItem' },
              Title: 'Event Feedback Response',
              SurveyJSON: JSON.stringify(responseData),
              EventTitles: responseData.eventTitles.join(', '),
              SubmittedBy: ctx.userDisplayName || 'Unknown',
              SubmitDate: new Date().toISOString()
            }),
            headers: {
              Accept: "application/json; odata=verbose",
              "X-RequestDigest": digest,
              "Content-Type": "application/json; odata=verbose"
            },
            timeout: 15000
          }).then(() => ({ success: true, message: 'Response saved successfully!' })).catch(xhr => ({
            success: false,
            message: xhr.responseJSON?.error?.message?.value || "Failed to save response"
          }));
        },
        refreshDigest(site) {
          return $.ajax({
            url: site + "/_api/contextinfo",
            method: "POST",
            headers: { Accept: "application/json; odata=verbose" },
            timeout: 10000
          }).then(d => ({ digest: d.d?.GetContextWebInformation?.FormDigestValue }));
        }
      };

      api.loadEvents(ctx.webAbsoluteUrl).then(eventTitles => {
        if (btoa(eventTitles.join(',')).substring(0, 10) !== surveyId) {
          $('#surveyElement').html('<div class="alert alert-danger">Invalid survey ID.</div>');
          return;
        }
        const surveyJson = {
          title: "Event Feedback Survey",
          pages: [{
            name: "page1",
            elements: [
              ...eventTitles.map(title => ({
                type: "rating",
                name: title.replace(/\s+/g, '_').toLowerCase(),
                title: `How would you rate "${title}"?`,
                isRequired: true,
                rateMin: 1,
                rateMax: 5,
                minRateDescription: "Poor",
                maxRateDescription: "Excellent",
                renderAs: "stars"
              })),
              {
                type: "textarea",
                name: "comments",
                title: "Any ideas for future classes, comments, concerns or suggestion?",
                isRequired: false,
                maxLength: 1000,
                rows: 5
              }
            ]
          }]
        };
        const survey = new Survey.Model(surveyJson);
        survey.render('surveyElement');
        survey.onComplete.add(async (sender) => {
          const responseData = { ...sender.data, eventTitles };
          const digest = (await api.refreshDigest(ctx.webAbsoluteUrl)).digest;
          const result = await api.saveSurveyResponse(ctx.webAbsoluteUrl, digest, responseData);
          alert(result.message);
          if (result.success) window.location.href = ctx.webAbsoluteUrl;
        });
      }).catch(() => {
        $('#surveyElement').html('<div class="alert alert-danger">Failed to load events.</div>');
      });
    });
  </script>
</asp:Content>