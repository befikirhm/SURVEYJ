<%@ Page Language="C#" Inherits="Microsoft.SharePoint.WebPartPages.WebPartPage" %>
<%@ Register Tagprefix="SharePoint" Namespace="Microsoft.SharePoint.WebControls" Assembly="Microsoft.SharePoint, Version=15.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c" %>

<!DOCTYPE html>
<html>
<head>
  <title>Admin Dashboard</title>
  <SharePoint:CssRegistration name="/_layouts/15/1033/styles/corev15.css" runat="server" />
  <SharePoint:CssRegistration name="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/css/bootstrap.min.css" runat="server" />
  <style>
    body { padding: 20px; background: #f5f5f5; }
    .btn { margin: 5px; }
  </style>
</head>
<body>
  <SharePoint:FormDigest ID="FormDigest1" runat="server" />

  <div class="container">
    <h2>Event Admin Dashboard</h2>
    <p><a href="EventsDashboard.aspx" class="btn btn-info">Back to Events</a></p>
    <hr />

    <div class="panel panel-default">
      <div class="panel-heading">Manage Events</div>
      <div class="panel-body">
        <p><a href="/Lists/Events/NewForm.aspx" class="btn btn-success">Create New Event</a></p>
        <p><a href="/Lists/Events/AllItems.aspx" class="btn btn-primary">View All Events</a></p>
      </div>
    </div>

    <div class="panel panel-default">
      <div class="panel-heading">Registrations</div>
      <div class="panel-body">
        <p><a href="/Lists/Registrations/AllItems.aspx" class="btn btn-warning">View All Registrations</a></p>
      </div>
    </div>
  </div>
</body>
</html>