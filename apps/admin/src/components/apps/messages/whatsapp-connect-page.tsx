import ChannelConnectPage from './channel-connect-page'
import WhatsappSignupCard from './whatsapp-signup-card'

/** Apps → WhatsApp → Connect: one-step Embedded Signup when set up, else the pasted details. */
export default function WhatsappConnectPage() {
  return <ChannelConnectPage channelId="whatsapp" lead={<WhatsappSignupCard />} />
}
