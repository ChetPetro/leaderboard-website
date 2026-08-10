export class AdminApi {
  constructor(httpClient) {
    this.httpClient = httpClient;
    this.logMapPoints = this.logMapPoints.bind(this);
  }

  fetchStatus(token) {
    return this.httpClient.request('/admin/status', {
      token,
      errorMessage: 'Could not verify admin access.'
    });
  }

  deleteEntry(mapKey, discordID, token) {
    return this.httpClient.request(`/admin/leaderboards/${mapKey}/entries/${discordID}`, {
      method: 'DELETE',
      token,
      errorMessage: 'Failed to delete entry.'
    });
  }

  deleteMotwEntry(mapKey, discordID, token) {
    return this.httpClient.request(`/admin/leaderboards/${mapKey}/motw/entries/${discordID}`, {
      method: 'DELETE',
      token,
      errorMessage: 'Failed to delete MOTW entry.'
    });
  }

  deleteMap(mapKey, token) {
    return this.httpClient.request(`/admin/leaderboards/${mapKey}`, {
      method: 'DELETE',
      token,
      errorMessage: 'Failed to delete map.'
    });
  }

  logMapPoints(mapKey, token) {
    return this.httpClient.request(`/admin/leaderboards/${mapKey}/map-points`, {
      token,
      errorMessage: 'Failed to log map points.'
    });
  }

  recomputeMapPoints(mapKey, token) {
    return this.httpClient.request(`/admin/leaderboards/${mapKey}/recompute-map-points`, {
      method: 'POST',
      token,
      errorMessage: 'Failed to recompute map points.'
    });
  }

  rerollMotw(token) {
    return this.httpClient.request('/admin/motw/reroll', {
      method: 'POST',
      token,
      errorMessage: 'Failed to reroll Map of the Week.'
    });
  }
}
