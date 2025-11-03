<%@ Page Language="C#" MasterPageFile="~masterurl/default.master" Inherits="Microsoft.SharePoint.WebPartPages.WebPartPage, Microsoft.SharePoint, Version=15.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c" %>
<%@ Register TagPrefix="SharePoint" Namespace="Microsoft.SharePoint.WebControls" Assembly="Microsoft.SharePoint, Version=15.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c" %>
<asp:Content ContentPlaceHolderID="PlaceHolderMain" runat="server">
  <link href="https://unpkg.com/bootstrap@3.3.7/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://unpkg.com/survey-core/defaultV2.min.css" rel="stylesheet">
  <link href="https://unpkg.com/survey-creator-core/survey-creator-core.min.css" rel="stylesheet">
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
      <div id="loading" class="alert alert-info text-center">Loading...</div>
    </div>
  </div>
  <script src="https://unpkg.com/jquery@3.6.0/dist/jquery.min.js"></script>
  <script src="https://unpkg.com/bootstrap@3.3.7/dist/js/bootstrap.min.js"></script>
  <script src="https://unpkg.com/react@17.0.2/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@17.0.2/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/survey-core/survey.core.min.js"></script>
  <script src="https://unpkg.com/survey-creator-core/survey-creator-core.min.js"></script>
  <script src="https://unpkg.com/survey-creator-knockout/survey-creator-knockout.min.js"></script>
  <script src="https://unpkg.com/survey-knockout/survey.min.js"></script>
  <script src="/SiteAssets/events-app.js"></script>
</asp:Content>