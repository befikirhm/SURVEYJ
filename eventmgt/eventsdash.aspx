<%@ Page Language="C#" MasterPageFile="~masterurl/default.master" Inherits="Microsoft.SharePoint.WebPartPages.WebPartPage, Microsoft.SharePoint, Version=15.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c" %>
<%@ Register TagPrefix="SharePoint" Namespace="Microsoft.SharePoint.WebControls" Assembly="Microsoft.SharePoint, Version=15.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c" %>
<asp:Content ContentPlaceHolderID="PlaceHolderMain" runat="server">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@3.3.7/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/survey-core@1.9.100/defaultV2.min.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/survey-creator-core@1.9.100/survey-creator-core.min.css" rel="stylesheet">
  <style>
    .sidenav { width: 200px; float: left; margin-right: 20px; }
    .nav-stacked > li { margin-bottom: 10px; }
    .event-container { margin-left: 220px; }
    .nomargin { margin: 0; }
    #loading { display: none; }
  </style>
  <div class="container">
    <div class="sidenav">
      <div id="adminLinks"></div>
    </div>
    <div class="event-container">
      <input type="text" id="searchBox" class="form-control" placeholder="Search events...">
      <div id="root"></div>
      <div id="loading" className="alert alert-info text-center">Loading...</div>
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@3.3.7/dist/js/bootstrap.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/react@17.0.2/umd/react.production.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/react-dom@17.0.2/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/survey-core@1.9.100/survey.core.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/survey-react-ui@1.9.100/survey-react-ui.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/survey-creator-core@1.9.100/survey-creator-core.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/survey-creator-react@1.9.100/survey-creator-react.min.js"></script>
  <script src="/SiteAssets/events-app.js"></script>
</asp:Content>