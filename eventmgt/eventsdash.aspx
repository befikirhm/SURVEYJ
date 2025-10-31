<%@ Page Language="C#" Inherits="Microsoft.SharePoint.WebPartPages.WebPartPage" %>
<%@ Register Tagprefix="SharePoint" Namespace="Microsoft.SharePoint.WebControls" Assembly="Microsoft.SharePoint, Version=15.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c" %>
<%@ Register Tagprefix="Utilities" Namespace="Microsoft.SharePoint.Utilities" Assembly="Microsoft.SharePoint, Version=15.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c" %>

<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Events Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <!-- BOOTSTRAP 3 + JQUERY -->
  <SharePoint:CssRegistration name="/_layouts/15/1033/styles/corev15.css" runat="server" />
  <SharePoint:CssRegistration name="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/css/bootstrap.min.css" runat="server" />
  <SharePoint:ScriptLink language="javascript" name="https://code.jquery.com/jquery-3.6.0.min.js" runat="server" />
  <SharePoint:ScriptLink language="javascript" name="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/js/bootstrap.min.js" runat="server" />
  <SharePoint:ScriptLink language="javascript" name="https://unpkg.com/react@16/umd/react.production.min.js" runat="server" />
  <SharePoint:ScriptLink language="javascript" name="https://unpkg.com/react-dom@16/umd/react-dom.production.min.js" runat="server" />

  <!-- CUSTOM CSS -->
  <style>
    body { background: #f5f5f5; font-family: "Segoe UI", Tahoma, sans-serif; }
    .container { margin-top: 20px; }
    .panel { box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
    .card-full { opacity: 0.8; }
    .card-past { background: #f9f9f9; }
    #loading { text-align: center; margin: 40px; font-size: 18px; }
    #adminLinks { margin-bottom: 20px; }
    .modal-header { background: #d9534f; color: white; }
    .modal-title { font-weight: bold; }
  </style>
</head>
<body>
  <SharePoint:FormDigest ID="FormDigest1" runat="server" />

  <div class="container">
    <h2 class="text-center">Training Events</h2>

    <!-- ADMIN LINKS -->
    <div id="adminLinks"></div>

    <!-- SEARCH -->
    <div class="form-group">
      <input type="text" id="searchBox" class="form-control" placeholder="Search by title or room..." />
    </div>

    <!-- LOADING -->
    <div id="loading" style="display:none;">
      <div class="spinner-border text-primary" role="status"></div>
      <p>Loading events...</p>
    </div>

    <!-- EVENT CARDS -->
    <div id="root"></div>
  </div>

  <!-- UNREGISTER MODAL -->
  <div class="modal fade" id="unregModal" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <button type="button" class="close" data-dismiss="modal">&times;</button>
          <h4 class="modal-title">Confirm Cancellation</h4>
        </div>
        <div class="modal-body">
          <p>Are you sure you want to cancel your registration?</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-default" data-dismiss="modal">No</button>
          <button type="button" class="btn btn-danger" id="confirmUnreg">Yes, Cancel</button>
        </div>
      </div>
    </div>
  </div>

  <!-- LOAD APP -->
  <SharePoint:ScriptLink language="javascript" name="/SiteAssets/eventsApp.js" runat="server" Localizable="false" />
</body>
</html>