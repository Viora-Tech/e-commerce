# Channel connect shows the partner's reason; Disconnected is not an error

- A failed Facebook/Google connect now passes the partner's readable reason
  (`ChannelApiError` message, e.g. "No Google Merchant Center account found…") back in
  `?reason=` and the toast shows it under "Could not connect …".
- A channel the merchant disconnected shows the "Not connected" chip and a neutral bar
  ("Disconnected · … Reconnect") instead of "Needs attention" and a red bar.
