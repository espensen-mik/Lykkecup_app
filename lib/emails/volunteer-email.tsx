import { Body, Container, Head, Hr, Html, Img, Link, Preview, Section, Text } from "@react-email/components";
import type { Block, Inline } from "@/lib/volunteer-mail-format";

const NAVY = "#0f2442";
const GREEN = "#22b573";
const FONT = "Inter, 'Segoe UI', Helvetica, Arial, sans-serif";

function InlineParts({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) => {
        const style = p.bold || p.italic ? { fontWeight: p.bold ? 700 : undefined, fontStyle: p.italic ? ("italic" as const) : undefined } : undefined;
        return p.type === "link" ? (
          <Link key={i} href={p.href} style={{ color: "#138a55", textDecoration: "underline", ...style }}>
            {p.text}
          </Link>
        ) : (
          <span key={i} style={style}>
            {p.text}
          </span>
        );
      })}
    </>
  );
}

const textStyle = { margin: "0 0 16px", fontSize: "16px", lineHeight: "26px", color: "#1f2937", fontFamily: FONT };

export function VolunteerEmail({
  blocks,
  preview,
  siteUrl,
  eventName,
}: {
  blocks: Block[];
  preview: string;
  siteUrl: string;
  eventName: string;
}) {
  return (
    <Html lang="da">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, padding: "24px 12px", backgroundColor: "#eef2f6", fontFamily: FONT }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", borderRadius: "16px", overflow: "hidden", backgroundColor: "#ffffff" }}>
          <Section style={{ backgroundColor: NAVY, padding: "28px 32px" }}>
            <Img src={`${siteUrl}/email/lykkeliga-logo-white.png`} width="140" height="52" alt="Lykkeliga" style={{ display: "block" }} />
            <Text
              style={{
                margin: "14px 0 0",
                fontSize: "12px",
                lineHeight: "16px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: "#5ee0a4",
                fontFamily: FONT,
              }}
            >
              {eventName} · Frivillig
            </Text>
          </Section>
          <Section style={{ height: "4px", backgroundColor: GREEN, lineHeight: "4px", fontSize: "4px" }}>&nbsp;</Section>
          <Section style={{ padding: "32px 32px 16px" }}>
            {blocks.map((b, i) =>
              b.type === "paragraph" ? (
                <Text key={i} style={textStyle}>
                  {b.lines.map((line, j) => (
                    <span key={j}>
                      {j > 0 ? <br /> : null}
                      <InlineParts parts={line} />
                    </span>
                  ))}
                </Text>
              ) : (
                <ul key={i} style={{ margin: "0 0 16px", paddingLeft: "22px", color: "#1f2937", fontFamily: FONT }}>
                  {b.items.map((item, j) => (
                    <li key={j} style={{ fontSize: "16px", lineHeight: "26px", marginBottom: "4px" }}>
                      <InlineParts parts={item} />
                    </li>
                  ))}
                </ul>
              ),
            )}
          </Section>
          <Section style={{ padding: "0 32px 28px" }}>
            <Hr style={{ borderColor: "#e5e7eb", margin: "0 0 16px" }} />
            <Text style={{ margin: 0, fontSize: "13px", lineHeight: "20px", color: "#6b7280", fontFamily: FONT }}>
              Du får denne mail, fordi du er tilmeldt som frivillig til {eventName}. Har du spørgsmål, kan du bare svare på mailen.
            </Text>
            <Text style={{ margin: "10px 0 0", fontSize: "13px", lineHeight: "20px", color: "#9ca3af", fontFamily: FONT }}>
              {eventName} · Lykkeliga
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
