<%@ Page Language="C#" MasterPageFile="~masterurl/default.master" Inherits="Microsoft.SharePoint.WebPartPages.WebPartPage, Microsoft.SharePoint, Version=15.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c" %>
<%@ Register TagPrefix="WebPartPages" Namespace="Microsoft.SharePoint.WebPartPages" Assembly="Microsoft.SharePoint, Version=15.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c" %>
<asp:Content ContentPlaceHolderID="PlaceHolderMain" runat="server">
  <WebPartPages:SPProxyWebPartManager runat="server" />
  <script src="https://unpkg.com/react@17.0.2/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@17.0.2/umd/react-dom.production.min.js"></script>
  <script src="https://code.jquery.com/jquery-1.12.4.min.js"></script>
  <script>
    if (!window.React) {
      document.write('<script src="https://cdnjs.cloudflare.com/ajax/libs/react/17.0.2/umd/react.production.min.js"></scr' + 'ipt>');
    }
    if (!window.ReactDOM) {
      document.write('<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/17.0.2/umd/react-dom.production.min.js"></scr' + 'ipt>');
    }
    if (!window.jQuery) {
      document.write('<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.4/jquery.min.js"></scr' + 'ipt>');
    }
  </script>
  <script src="/SiteAssets/eventsApp.js"></script>
  <div id="root"></div>
  <div id="loading" style="display: none; text-align: center; padding: 20px;">Loading...</div>
  <input id="searchBox" type="text" placeholder="Search events..." class="form-control mb-3" />
  <div id="adminLinks"></div>
  <style>
    #root, .event-container, .event-row, .panel, .col-md-6 {
      display: block !important;
      visibility: visible !important;
      position: relative !important;
      z-index: 100 !important;
      opacity: 1 !important;
      min-height: 100px;
      width: 100%;
      box-sizing: border-box;
    }
    .panel {
      margin-bottom: 20px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .panel-heading {
      background-color: #f5f5f5;
      padding: 10px;
      font-weight: bold;
    }
    .panel-body {
      padding: 15px;
    }
    .panel-footer {
      padding: 10px;
      background-color: #f5f5f5;
    }
    .modal {
      z-index: 1050 !important;
      background: transparent !important;
    }
    .modal-backdrop {
      z-index: 1040 !important;
    }
    #s4-workspace, #s4-bodyContainer, .ms-core-overlay {
      z-index: 1 !important;
      position: static !important;
      overflow: visible !important;
      display: block !important;
    }
    .alert {
      padding: 15px;
      margin: 10px 0;
      border-radius: 4px;
    }
    .alert-info {
      background-color: #d9edf7;
      border-color: #bce8f1;
      color: #31708f;
    }
    .alert-danger {
      background-color: #f2dede;
      border-color: #ebccd1;
      color: #a94442;
    }
  </style>
</asp:Content>