// EditModal component for editing survey metadata
class EditModal extends React.Component {
  constructor(props) {
    super(props);
    // Initialize state with survey metadata
    this.state = {
      form: {
        Owners: Array.isArray(this.props.survey.Owners?.results)
          ? this.props.survey.Owners.results.map(function(o) { return { Id: o.Id, Title: o.Title }; })
          : [],
        StartDate: this.props.survey.StartDate ? new Date(this.props.survey.StartDate).toISOString().split('T')[0] : '',
        EndDate: this.props.survey.EndDate ? new Date(this.props.survey.EndDate).toISOString().split('T')[0] : '',
        Status: this.props.survey.Status || 'Draft'
      },
      searchTerm: '',
      searchResults: [],
      isLoadingUsers: false,
      isSaving: false,
      showDropdown: false
    };
    this.handleUserSelect = this.handleUserSelect.bind(this);
    this.handleUserRemove = this.handleUserRemove.bind(this);
    this.handleSave = this.handleSave.bind(this);
  }
  componentDidMount() {
    this._isMounted = true;
  }
  componentWillUnmount() {
    this._isMounted = false;
    clearTimeout(this._debounce);
  }
  // Debounce user search for performance
  componentDidUpdate(prevProps, prevState) {
    var _this = this;
    if (prevState.searchTerm !== this.state.searchTerm) {
      if (!this.state.searchTerm) {
        this.setState({ searchResults: [], showDropdown: false });
        return;
      }
      clearTimeout(this._debounce);
      this._debounce = setTimeout(function() {
        _this.setState({ isLoadingUsers: true });
        // Use Search API to find users across SharePoint
        var queryText = 'contentclass:STS_User *' + encodeURIComponent(_this.state.searchTerm) + '*';
        jQuery.ajax({
          url: window._spPageContextInfo.webAbsoluteUrl + '/_api/search/query?querytext=\'' + queryText + '\'&selectproperties=\'AccountName,PreferredName,UserProfile_GUID\'&sourceid=\'b09a7990-05ea-4af9-81ef-edfab16c4e31\'&rowlimit=10',
          headers: {
            'Accept': 'application/json; odata=verbose',
            'X-RequestDigest': jQuery('#__REQUESTDIGEST').val() || window._spPageContextInfo.formDigestValue
          },
          xhrFields: { withCredentials: true }
        }).done(function(data) {
          if (!_this._isMounted) return;
          var users = (data.d.query.PrimaryQueryResult.RelevantResults.Table.Rows.results || [])
            .map(function(row) {
              var cells = row.Cells.results.reduce(function(acc, cell) {
                acc[cell.Key] = cell.Value;
                return acc;
              }, {});
              return {
                Id: cells.UserProfile_GUID ? parseInt(cells.UserProfile_GUID, 10) || 0 : 0,
                Title: cells.PreferredName || cells.AccountName || 'Unknown User'
              };
            })
            .filter(function(u) { return u.Id !== 0 && u.Title; });
          // Filter out already selected owners
          var availableUsers = users.filter(function(u) {
            return !_this.state.form.Owners.some(function(selected) { return selected.Id === u.Id; });
          });
          _this.setState({ searchResults: availableUsers, isLoadingUsers: false, showDropdown: availableUsers.length > 0 });
        }).fail(function(xhr, status, error) {
          if (!_this._isMounted) return;
          console.error('Error searching users:', error, xhr.responseText);
          _this.props.addNotification('Failed to search users: ' + (xhr.responseText || error), 'error');
          _this.setState({ isLoadingUsers: false, showDropdown: false });
        });
      }, 300);
    }
  }
  // Add selected user to owners
  handleUserSelect(user) {
    this.setState({
      form: Object.assign({}, this.state.form, { Owners: this.state.form.Owners.concat([user]) }),
      searchTerm: '',
      showDropdown: false
    });
  }
  // Remove user from owners (prevent removing current user)
  handleUserRemove(userId) {
    if (userId === this.props.currentUserId) {
      this.props.addNotification('You cannot remove yourself as an owner.', 'error');
      return;
    }
    this.setState({
      form: Object.assign({}, this.state.form, {
        Owners: this.state.form.Owners.filter(function(o) { return o.Id !== userId; })
      })
    });
  }
  // Save metadata to SharePoint list with date validation
  handleSave() {
    var _this = this;
    // Validate EndDate > StartDate
    if (this.state.form.StartDate && this.state.form.EndDate &&
        new Date(this.state.form.EndDate) <= new Date(this.state.form.StartDate)) {
      this.props.addNotification('End Date must be after Start Date.', 'error');
      this.setState({ isSaving: false });
      return;
    }
    // Ensure current user remains an owner
    if (!this.state.form.Owners.some(function(o) { return o.Id === _this.props.currentUserId; })) {
      this.props.addNotification('You must remain an owner of the survey.', 'error');
      return;
    }
    this.setState({ isSaving: true });
    getDigest().then(function(digest) {
      var payload = {
        '__metadata': { 'type': 'SP.Data.SurveysListItem' },
        OwnersId: { results: _this.state.form.Owners.map(function(o) { return o.Id; }) },
        Status: _this.state.form.Status
      };
      if (_this.state.form.StartDate) payload.StartDate = new Date(_this.state.form.StartDate).toISOString();
      if (_this.state.form.EndDate) payload.EndDate = new Date(_this.state.form.EndDate).toISOString();
      console.log('Saving metadata for survey:', _this.props.survey.Id, payload);
      jQuery.ajax({
        url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items(' + _this.props.survey.Id + ')',
        type: 'POST',
        data: JSON.stringify(payload),
        headers: {
          'X-HTTP-Method': 'MERGE',
          'If-Match': '*',
          'Accept': 'application/json; odata=verbose',
          'Content-Type': 'application/json; odata=verbose',
          'X-RequestDigest': digest
        },
        xhrFields: { withCredentials: true }
      }).then(function() {
        return jQuery.ajax({
          url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items(' + _this.props.survey.Id + ')/effectiveBasePermissions',
          headers: { 'Accept': 'application/json; odata=verbose' },
          xhrFields: { withCredentials: true }
        });
      }).then(function(permissions) {
        var hasManagePermissions = permissions.d.EffectiveBasePermissions.High & 0x00000080;
        if (hasManagePermissions) {
          return jQuery.ajax({
            url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items(' + _this.props.survey.Id + ')/breakroleinheritance(copyRoleAssignments=false, clearSubscopes=true)',
            type: 'POST',
            headers: {
              'Accept': 'application/json; odata=verbose',
              'X-RequestDigest': digest
            },
            xhrFields: { withCredentials: true }
          }).then(function() {
            if (_this.state.form.Owners.length > 0) {
              return Promise.all(_this.state.form.Owners.map(function(user) {
                return jQuery.ajax({
                  url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items(' + _this.props.survey.Id + ')/roleassignments/addroleassignment(principalid=' + user.Id + ', roledefid=1073741827)',
                  type: 'POST',
                  headers: {
                    'Accept': 'application/json; odata=verbose',
                    'X-RequestDigest': digest
                  },
                  xhrFields: { withCredentials: true }
                });
              }));
            }
          });
        } else {
          _this.props.addNotification('Survey metadata updated. Permissions not modified due to insufficient access.', 'warning');
        }
      }).then(function() {
        _this.props.addNotification('Survey metadata and permissions updated successfully!');
        console.log('Metadata save successful for survey:', _this.props.survey.Id);
        _this.props.loadSurveys();
        _this.props.onClose();
        _this.setState({ isSaving: false });
      }).fail(function(error) {
        console.error('Error updating survey:', error);
        var errorMessage = error.responseText || error.message || 'Unknown error';
        if (error.status === 403) errorMessage = 'Access denied. Ensure you have Manage Permissions on this survey.';
        else if (errorMessage.includes('Invalid Form Digest')) errorMessage = 'Invalid or expired request digest token. Please try again.';
        _this.props.addNotification('Failed to update survey: ' + errorMessage, 'error');
        _this.setState({ isSaving: false });
      });
    }).fail(function(error) {
      console.error('Error getting digest:', error);
      _this.props.addNotification('Failed to update survey: Unable to get request digest.', 'error');
      _this.setState({ isSaving: false });
    });
  }
  render() {
    var _this = this;
    return React.createElement('div', {
      className: 'fixed inset-0 flex items-center justify-center z-1000 bg-black/50'
    },
      React.createElement('div', {
        className: 'bg-white rounded-lg shadow-xl w-11/12 max-w-md sm:max-w-lg md:max-w-xl'
      },
        // Header with title and close button
        React.createElement('div', {
          className: 'flex justify-between items-center p-4 border-b bg-gray-100'
        },
          React.createElement('h2', {
            className: 'text-lg font-bold text-gray-800 truncate',
            title: 'Edit Metadata'
          }, 'Edit Metadata'),
          React.createElement('button', {
            type: 'button',
            className: 'text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full w-8 h-8 flex items-center justify-center',
            onClick: this.props.onClose,
            'aria-label': 'Close metadata modal'
          }, '\u00D7')
        ),
        // Form fields (Owners, StartDate, EndDate, Status)
        React.createElement('div', {
          className: 'p-6 max-h-96 overflow-y-auto'
        },
          React.createElement('div', { className: 'space-y-4' },
            // Owners field with search
            React.createElement('div', null,
              React.createElement('label', { className: 'block mb-1 text-gray-700' }, 'Owners'),
              React.createElement('div', { className: 'relative' },
                React.createElement('input', {
                  type: 'text',
                  value: this.state.searchTerm,
                  onChange: function(e) { _this.setState({ searchTerm: e.target.value }); },
                  placeholder: 'Search for users by name or email...',
                  className: 'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500',
                  'aria-label': 'Search for users'
                }),
                this.state.isLoadingUsers && React.createElement('div', { className: 'absolute top-2 right-2' },
                  React.createElement('div', { className: 'animate-spin rounded-full h-5 w-5 border-t-2 border-blue-500' })
                ),
                this.state.showDropdown && this.state.searchResults.length > 0 && React.createElement('ul', {
                  className: 'absolute z-10 w-full bg-white border rounded mt-1 max-h-48 overflow-y-auto shadow-lg'
                },
                  this.state.searchResults.map(function(user) {
                    return React.createElement('li', {
                      key: user.Id,
                      onClick: function() { _this.handleUserSelect(user); },
                      className: 'p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0',
                      role: 'option',
                      'aria-selected': 'false'
                    }, user.Title);
                  })
                )
              ),
              React.createElement('div', { className: 'mt-2 flex flex-wrap gap-2' },
                this.state.form.Owners.length === 0
                  ? React.createElement('p', { className: 'text-gray-500 text-sm' }, 'No owners selected')
                  : this.state.form.Owners.map(function(user) {
                      return React.createElement('div', {
                        key: user.Id,
                        className: 'flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm'
                      },
                        React.createElement('span', null, user.Title),
                        React.createElement('button', {
                          type: 'button',
                          onClick: function() { _this.handleUserRemove(user.Id); },
                          className: 'ml-2 text-red-600 hover:text-red-800 font-bold',
                          disabled: user.Id === _this.props.currentUserId,
                          'aria-label': 'Remove ' + user.Title + ' from owners'
                        }, user.Id === _this.props.currentUserId ? '' : '\u00D7')
                      );
                    })
              )
            ),
            // Start Date
            React.createElement('div', null,
              React.createElement('label', { className: 'block mb-1 text-gray-700' }, 'Start Date'),
              React.createElement('input', {
                type: 'date',
                value: this.state.form.StartDate,
                onChange: function(e) { _this.setState({ form: Object.assign({}, _this.state.form, { StartDate: e.target.value }) }); },
                className: 'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500',
                'aria-label': 'Start date'
              })
            ),
            // End Date
            React.createElement('div', null,
              React.createElement('label', { className: 'block mb-1 text-gray-700' }, 'End Date'),
              React.createElement('input', {
                type: 'date',
                value: this.state.form.EndDate,
                onChange: function(e) { _this.setState({ form: Object.assign({}, _this.state.form, { EndDate: e.target.value }) }); },
                className: 'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500',
                'aria-label': 'End date'
              })
            ),
            // Status
            React.createElement('div', null,
              React.createElement('label', { className: 'block mb-1 text-gray-700' }, 'Status'),
              React.createElement('select', {
                value: this.state.form.Status,
                onChange: function(e) { _this.setState({ form: Object.assign({}, _this.state.form, { Status: e.target.value }) }); },
                className: 'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500',
                'aria-label': 'Survey status'
              },
                React.createElement('option', { value: 'Publish' }, 'Publish'),
                React.createElement('option', { value: 'Draft' }, 'Draft')
              )
            )
          )
        ),
        // Footer with Save and Cancel buttons
        React.createElement('div', {
          className: 'flex flex-wrap gap-3 justify-end p-4 border-t bg-gray-50'
        },
          React.createElement('button', {
            type: 'button',
            className: 'bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 transition' + (this.state.isSaving ? ' opacity-50 cursor-not-allowed' : ''),
            onClick: this.handleSave.bind(this),
            disabled: this.state.isSaving,
            'aria-label': 'Save metadata'
          },
            this.state.isSaving
              ? [
                  React.createElement('div', { className: 'animate-spin rounded-full h-5 w-5 border-t-2 border-white mr-2', key: 'spinner' }),
                  'Saving...'
                ]
              : 'Save'
          ),
          React.createElement('button', {
            type: 'button',
            className: 'bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 transition',
            onClick: this.props.onClose,
            disabled: this.state.isSaving,
            'aria-label': 'Cancel metadata edit'
          }, 'Cancel')
        )
      )
    );
  }
}