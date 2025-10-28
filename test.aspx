<%@ Page Language="C#" %>
<%@ Register Tagprefix="SharePoint" Namespace="Microsoft.SharePoint.WebControls" Assembly="Microsoft.SharePoint, Version=15.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c" %>
<!DOCTYPE html>
<html>
<head>
  <title>Forms Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <SharePoint:FormDigest runat="server" />

  <!-- JSOM -->
  <script type="text/javascript" src="/_layouts/15/init.js"></script>
  <script type="text/javascript" src="/_layouts/15/sp.runtime.js"></script>
  <script type="text/javascript" src="/_layouts/15/sp.js"></script>

  <!-- Libraries -->
  <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/qrious@4.0.2/dist/qrious.min.js"></script>

  <!-- Your App -->
  <script src="/SiteAssets/dashboard-sp2016.js"></script>
</head>
<body>

  <!-- SharePoint Ribbon (hidden) -->
  <div id="s4-ribbonrow"></div>
  <div id="s4-workspace"></div>

  <!-- React App (full screen) -->
  <div id="react-app-container" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999; background: #f3f4f6;">
    <div id="root"></div>
  </div>

</body>
</html>