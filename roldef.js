function grantEditPermissionToOwners(itemId, ownerIds, onSuccess, onError) {
  if (!ownerIds.length) return onSuccess();

  getDigest().then(digest => {
    const listUrl = spUrl(`_api/web/lists/getbytitle('Surveys')`);
    const itemUrl = listUrl + `/items(${itemId})`;

    // 1. Break inheritance via REST
    $.ajax({
      url: itemUrl + '/breakroleinheritance(copyRoleAssignments=false)',
      method: 'POST',
      headers: { 'X-RequestDigest': digest },
      xhrFields: { withCredentials: true }
    }).then(() => {
      // 2. Use SOAP to assign FULL CONTROL
      const soapPromises = ownerIds.map(principalId => {
        const soapEnvelope = `
          <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                         xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                         xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Body>
              <AddPermission xmlns="http://schemas.microsoft.com/sharepoint/soap/directory/">
                <objectId>${itemId}</objectId>
                <objectType>ListItem</objectType>
                <permissionMask>0x7FFFFFFFFFFFFFFF</permissionMask>
                <principalId>${principalId}</principalId>
                <principalType>User</principalType>
                <listId>{YOUR_LIST_GUID}</listId>
              </AddPermission>
            </soap:Body>
          </soap:Envelope>`;

        return $.ajax({
          url: spUrl('_vti_bin/Permissions.asmx'),
          type: 'POST',
          data: soapEnvelope,
          contentType: 'text/xml; charset=utf-8',
          dataType: 'xml',
          headers: {
            'SOAPAction': 'http://schemas.microsoft.com/sharepoint/soap/directory/AddPermission'
          },
          xhrFields: { withCredentials: true }
        });
      });

      Promise.all(soapPromises)
        .then(() => {
          // Optional: Grant Read on List (REST)
          const listPromises = ownerIds.map(id =>
            $.ajax({
              url: listUrl + `/roleassignments/addroleassignment(principalid=${id}, roledefid=1073741826)`,
              method: 'POST',
              headers: { 'X-RequestDigest': digest },
              xhrFields: { withCredentials: true }
            })
          );
          return Promise.all(listPromises);
        })
        .then(onSuccess)
        .catch(err => {
          console.error('SOAP Permission Error:', err);
          onError(err);
        });
    }).catch(onError);
  });
}