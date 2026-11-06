# Send-only Meta tokens are accepted

Tokens from "Generate access token" on a Meta dataset can send events but cannot read the pixel, so saving one failed with "(#100) Missing Permission". When the read is refused for permission, one test event now decides. A token that cannot send is still refused.
