<%@ Page Language="C#" Inherits="Microsoft.SharePoint.WebPartPages.WebPartPage" %>
<%@ Register Tagprefix="SharePoint" Namespace="Microsoft.SharePoint.WebControls" Assembly="Microsoft.SharePoint, Version=15.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c" %>

<!DOCTYPE html>
<html>
<head>
  <title>Forms Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <SharePoint:FormDigest runat="server" />

  <!-- Tailwind (optional) -->
  <script src="https://cdn.tailwindcss.com"></script>

  <!-- JSOM -->
  <script type="text/javascript" src="/_layouts/15/init.js"></script>
  <script type="text/javascript" src="/_layouts/15/sp.runtime.js"></script>
  <script type="text/javascript" src="/_layouts/15/sp.js"></script>

  <!-- Libraries -->
  <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/qrious@4.0.2/dist/qrious.min.js"></script>

  <!-- Font Awesome -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />

  <!-- Your App -->
  <script src="/SiteAssets/dashboard-sp2016.js"></script>

  <style>
    /* COMPLETELY HIDE SHAREPOINT UI */
    #s4-ribbonrow, #s4-titlerow, #s4-leftpanel, #s4-workspace, 
    #suiteBar, #suiteBarButtons, #siteIcon, #suiteLinksBox, 
    #MSOZoneCell_WebPart, .ms-siteactions-root { 
      display: none !important; 
    }
    body, html { 
      margin: 0; padding: 0; height: 100%; overflow: hidden; 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    #react-app-container { 
      all: initial; 
      display: block; 
      position: fixed; 
      top: 0; left: 0; 
      width: 100%; height: 100%; 
      background: #f3f4f6; 
      z-index: 9999;
    }
  </style>
</head>
<body>

  <!-- SharePoint keeps this for context -->
  <div id="s4-ribbonrow"></div>
  <div id="s4-workspace"></div>

  <!-- REACT APP – FULL CONTROL -->
  <div id="react-app-container">
    <div id="root"></div>
  </div>

</body>
</html>