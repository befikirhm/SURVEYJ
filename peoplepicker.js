// In EditModal.componentDidUpdate (replace the entire search logic)
if (prevState.searchTerm !== this.state.searchTerm && this.state.searchTerm) {
  clearTimeout(this._debounce);
  this._debounce = setTimeout(() => {
    this.setState({ isLoadingUsers: true });
    getDigest().then(digest => {
      const payload = {
        queryParams: {
          __metadata: { type: 'SP.UI.ApplicationPages.ClientPeoplePickerQueryParameters' },
          AllowEmailAddresses: true,
          AllowMultipleEntities: false,
          AllUrlZones: false,
          MaximumEntitySuggestions: 50,
          PrincipalSource: 15,  // All sources (users, groups, AD, etc.)
          PrincipalType: 1,     // Users only (use 15 for users + groups)
          QueryString: this.state.searchTerm,
          Required: false,
          SharePointGroupID: null,
          UrlZone: null,
          WebApplicationID: null
        }
      };

      jQuery.ajax({
        url: spUrl('/_api/SP.UI.ApplicationPages.ClientPeoplePickerWebServiceInterface.clientPeoplePickerSearchUser'),
        method: 'POST',
        data: JSON.stringify(payload),
        headers: {
          Accept: 'application/json; odata=verbose',
          'Content-Type': 'application/json; odata=verbose',
          'X-RequestDigest': digest
        },
        xhrFields: { withCredentials: true }
      }).then(response => {
        const results = JSON.parse(response.d.ClientPeoplePickerSearchUser);
        // Filter to users only and map to your format
        const users = results.filter(r => r.EntityType === 1)  // 1 = User
          .map(r => ({ 
            Id: r.EntityData.SPUserId,  // SP User ID
            Title: r.DisplayText,
            LoginName: r.EntityData.LoginName,
            Email: r.EntityData.Email
          }));
        const available = users.filter(u => !this.state.form.Owners.some(o => o.Id === u.Id));
        this.setState({ 
          searchResults: available, 
          isLoadingUsers: false, 
          showDropdown: available.length > 0 
        });
      }).catch(err => {
        console.error('People Picker Search Error:', err);
        this.props.addNotification('Search failed: ' + (err.responseJSON?.error?.message || err.message), 'error');
        this.setState({ isLoadingUsers: false, showDropdown: false });
      });
    });
  }, 300);
}