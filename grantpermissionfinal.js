// -------------------------------------------------------------------
// 4. REST-ONLY PERMISSIONS – WITH DEFERRED DefaultViewUrl
// -------------------------------------------------------------------
function grantEditPermissionToOwners(itemId, ownerIds, onSuccess, onError) {
  if (!ownerIds.length) return onSuccess();

  getDigest().then(digest => {
    const listUrl = spUrl(`_api/web/lists/getbytitle('Surveys')`);
    const itemUrl = listUrl + `/items(${itemId})`;

    // 1. Get List + Deferred DefaultViewUrl
    $.ajax({
      url: listUrl,
      headers: { 'Accept': 'application/json;odata=verbose' },
      xhrFields: { withCredentials: true }
    }).then(listData => {
      const deferred = listData.d.DefaultViewUrl.__deferred;
      if (!deferred || !deferred.uri) throw new Error('DefaultViewUrl deferred missing');

      // 2. FOLLOW deferred URI
      $.ajax({
        url: deferred.uri,
        headers: { 'Accept': 'application/json;odata=verbose' },
        xhrFields: { withCredentials: true }
      }).then(viewData => {
        const defaultViewUrl = viewData.d.ServerRelativeUrl; // e.g. "/Lists/Surveys/AllItems.aspx"
        const viewName = defaultViewUrl.split('/').pop().split('.')[0]; // "AllItems"

        // 3. Get View GUID by Title
        $.ajax({
          url: listUrl + `/views?$filter=Title eq '${viewName}'`,
          headers: { 'Accept': 'application/json;odata=verbose' },
          xhrFields: { withCredentials: true }
        }).then(viewResp => {
          const viewId = viewResp.d.results[0]?.Id;
          if (!viewId) throw new Error('Default view not found');

          const viewUrl = listUrl + `/views('${viewId}')`;

          // 4. Break item inheritance
          $.ajax({
            url: itemUrl + '/breakroleinheritance(copyRoleAssignments=false)',
            method: 'POST',
            headers: { 'X-RequestDigest': digest },
            xhrFields: { withCredentials: true }
          }).then(() => {
            const promises = [];

            // 5. Grant Edit on ITEM
            ownerIds.forEach(id => {
              promises.push(
                $.ajax({
                  url: itemUrl + `/roleassignments/addroleassignment(principalid=${id}, roledefid=1073741827)`,
                  method: 'POST',
                  headers: { 'X-RequestDigest': digest },
                  xhrFields: { withCredentials: true }
                })
              );
            });

            // 6. Grant Read on LIST
            ownerIds.forEach(id => {
              promises.push(
                $.ajax({
                  url: listUrl + `/roleassignments/addroleassignment(principalid=${id}, roledefid=1073741826)`,
                  method: 'POST',
                  headers: { 'X-RequestDigest': digest },
                  xhrFields: { withCredentials: true }
                })
              );
            });

            // 7. Grant Read on DEFAULT VIEW
            ownerIds.forEach(id => {
              promises.push(
                $.ajax({
                  url: viewUrl + `/roleassignments/addroleassignment(principalid=${id}, roledefid=1073741826)`,
                  method: 'POST',
                  headers: { 'X-RequestDigest': digest },
                  xhrFields: { withCredentials: true }
                })
              );
            });

            Promise.all(promises)
              .then(onSuccess)
              .catch(err => {
                console.error('Permission grant failed:', err);
                onError(err);
              });
          });
        });
      });
    }).catch(err => {
      console.error('Failed to resolve DefaultViewUrl:', err);
      onError(err);
    });
  });
}