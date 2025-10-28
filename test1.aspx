<%@ Page Language="C#" Inherits="Microsoft.SharePoint.WebPartPages.WebPartPage" %>
<%@ Register Tagprefix="SharePoint" Namespace="Microsoft.SharePoint.WebControls" Assembly="Microsoft.SharePoint" %>

<!DOCTYPE html>
<html>
<head>
  <title>Forms Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <SharePoint:FormDigest runat="server" />

  <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/qrious@4.0.2/dist/qrious.min.js"></script>

  <script type="text/javascript" src="/_layouts/15/init.js"></script>
  <script type="text/javascript" src="/_layouts/15/sp.runtime.js"></script>
  <script type="text/javascript" src="/_layouts/15/sp.js"></script>

  <script src="/SiteAssets/dashboard-sp2016.js"></script>
</head>
<body>
  <div id="s4-ribbonrow"></div>
  <div id="s4-workspace"></div>
  <div id="react-app-container">
    <div id="root"></div>
  </div>
</body>
</html>