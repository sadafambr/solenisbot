import { type Message, MessageType, type TableData } from "./types";
import {
  graphPointsToTableData,
  metricsToBarChartData,
  parseKeyValueRecordLines,
  parseMarkdownTable,
  parseMetricLines,
  parseNumberedListTable,
  stripFirstMarkdownTable,
  stripLeadingParagraphBeforeNumberedList,
  wantsTabularDisplay,
  wantsTabularQuery,
  wantsVisualization,
} from "./response-formatting";

/** Agent steps often return an array of row objects (e.g. snowflake_agent) — normalize for DATA_TABLE. */
function tableDataFromObjectRows(rows: Record<string, unknown>[]): TableData | null {
  if (!rows?.length) return null;
  const first = rows[0];
  if (!first || typeof first !== "object") return null;
  const columns = Object.keys(first);
  if (!columns.length) return null;
  const outRows = rows.map((row) =>
    columns.map((c) => {
      const v = row[c];
      if (v == null) return "";
      if (typeof v === "number") return v;
      const s = String(v).replace(/,/g, "").trim();
      const n = Number(s);
      if (Number.isFinite(n) && /^-?[\d.]+$/.test(s)) return n;
      return String(v);
    })
  );
  return { columns, rows: outRows };
}

/** Backend sometimes returns non-string ellis_response; parsers expect string. */
function normalizeEllisText(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  const s = typeof raw === "string" ? raw : String(raw);
  return s.trim() === "" ? undefined : s;
}

/**
 * Only treat as API failure when `error` is meaningful.
 * Avoid false positives: e.g. empty arrays/objects are truthy in JS but not real errors.
 */
export function hasMeaningfulApiError(res: any): boolean {
  if (!res || typeof res !== "object") return false;
  if (res.error === true) return true;
  const e = res.error;
  if (typeof e === "string" && e.trim() !== "") return true;
  if (typeof e === "number" && !Number.isNaN(e) && e !== 0) return true;
  return false;
}

/** Last resort when transform returns null but the payload still has agent rows or ellis text. */
export function buildFallbackAssistantMessages(apiResponse: any, userInput: string = ""): Message[] | null {
  if (hasMeaningfulApiError(apiResponse)) return null;
  const present: any[] = Array.isArray(apiResponse?.conversation?.present_conversation)
    ? apiResponse.conversation.present_conversation
    : [];
  const agentTable = extractAgentTableData(present);
  const preferTable = wantsTabularDisplay(userInput, undefined);
  if (agentTable && (preferTable || (agentTable.rows?.length ?? 0) > 0)) {
    return [
      {
        id: Date.now().toString(),
        content: "",
        type: MessageType.DATA_TABLE,
        role: "assistant",
        timestamp: new Date(),
        tableData: agentTable,
      },
    ];
  }
  const ellisRaw = present.find((x: any) => x?.ellis_response)?.ellis_response;
  const text = normalizeEllisText(ellisRaw);
  if (text) {
    return [
      {
        id: Date.now().toString(),
        content: text,
        type: MessageType.TEXT,
        role: "assistant",
        timestamp: new Date(),
      },
    ];
  }
  return null;
}

/** First present_conversation entry whose value is an array of plain objects (Snowflake result set, etc.). */
function extractAgentTableData(presentConversation: any[]): TableData | null {
  for (const item of presentConversation) {
    if (!item || typeof item !== "object") continue;
    for (const val of Object.values(item)) {
      if (!Array.isArray(val) || val.length === 0) continue;
      if (!val.every((x) => x != null && typeof x === "object" && !Array.isArray(x))) continue;
      const td = tableDataFromObjectRows(val as Record<string, unknown>[]);
      if (td) return td;
    }
  }
  return null;
}

const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000").replace(/\/$/, "");

export async function askAlgo(userInput: string, conversationHistory: any[] = []) {
  try {
    const response = await fetch(`${apiBase}/ask-algo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_input: userInput,
        conversation_history: conversationHistory,
      }),
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type') || '';
      let errorBody = null;
      if (contentType.includes('application/json')) {
        errorBody = await response.json();
      } else {
        errorBody = await response.text();
      }
      console.error('askAlgo API non-ok response:', response.status, errorBody);
      return {
        error: true,
        status: response.status,
        message: errorBody?.error || errorBody || 'Network response was not ok',
        details: errorBody,
      };
    }

    return await response.json();
  } catch (error: unknown) {
    console.error('Error:', error);
    const message =
      error instanceof Error ? error.message : 'Network error';
    return {
      error: true,
      status: -1,
      message,
      details: error,
    };
  }
}

export function transformApiResponseToCharts(apiResponse: any, userInput: string = ""): Message[] | null {
  // Handle API-level errors returned from askAlgo
  if (hasMeaningfulApiError(apiResponse)) {
    const errorMessage = apiResponse.message || apiResponse.details || 'Sorry, failed to process request from server.';
    return [{
      id: Date.now().toString(),
      content: errorMessage,
      type: MessageType.TEXT,
      role: "assistant",
      timestamp: new Date(),
    }];
  }

  // Check if this is a clarification request
  if (apiResponse.requires_clarification) {
    return [{
      id: Date.now().toString(),
      content: String(apiResponse.clarification_question ?? ""),
      type: MessageType.CLARIFICATION,
      role: "assistant",
      timestamp: new Date(),
      clarification_question: apiResponse.clarification_question,
      requires_clarification: true,
    }];
  }

  const presentConversation: any[] = Array.isArray(apiResponse?.conversation?.present_conversation)
    ? apiResponse.conversation.present_conversation
    : [];

  const graphDataCandidate = presentConversation.find(
    (item: any) => item?.graph_and_summary_agent
  )?.graph_and_summary_agent;

  const graphOut = graphDataCandidate?.graph_output;
  const graphData =
    graphOut?.parameters != null &&
    typeof graphOut.function_name === "string" &&
    graphOut.function_name.length > 0 &&
    Array.isArray(graphOut.parameters.data)
      ? graphDataCandidate
      : undefined;

  // Extract insightful questions from present_conversation
  const insightfulQuestions = presentConversation.find(
    (item: any) => item?.insightful_questions
  )?.insightful_questions;

  const preferViz = wantsVisualization(userInput);
  const ellisRawEarly = presentConversation.find((item: any) => item?.ellis_response)?.ellis_response;
  const ellisResponseEarly = normalizeEllisText(ellisRawEarly);
  const preferTable = wantsTabularDisplay(userInput, ellisResponseEarly);

  if (!graphData) {
    const ellisResponse = ellisResponseEarly;
    if (ellisResponse) {
      const tableFromMd = parseMarkdownTable(ellisResponse);
      const kvTable = parseKeyValueRecordLines(ellisResponse);
      const numberedListTable = parseNumberedListTable(ellisResponse);

      if (preferViz) {
        const metrics = parseMetricLines(ellisResponse);
        if (metrics) {
          return [{
            id: Date.now().toString(),
            content: ellisResponse,
            type: MessageType.BAR_CHART,
            role: "assistant",
            timestamp: new Date(),
            chartData: metricsToBarChartData(metrics.labels, metrics.values),
            chartTitle: "Results",
            insightful_questions: insightfulQuestions,
          }];
        }
      }

      if (preferTable && tableFromMd) {
        const textOnly = stripFirstMarkdownTable(ellisResponse);
        return [{
          id: Date.now().toString(),
          content: textOnly || ellisResponse,
          type: MessageType.DATA_TABLE,
          role: "assistant",
          timestamp: new Date(),
          tableData: tableFromMd,
          insightful_questions: insightfulQuestions,
        }];
      }

      if (preferTable && kvTable) {
        return [{
          id: Date.now().toString(),
          content: ellisResponse,
          type: MessageType.DATA_TABLE,
          role: "assistant",
          timestamp: new Date(),
          tableData: kvTable,
          insightful_questions: insightfulQuestions,
        }];
      }

      if (preferTable && numberedListTable) {
        const intro = stripLeadingParagraphBeforeNumberedList(ellisResponse);
        return [{
          id: Date.now().toString(),
          content: intro || ellisResponse,
          type: MessageType.DATA_TABLE,
          role: "assistant",
          timestamp: new Date(),
          tableData: numberedListTable,
          insightful_questions: insightfulQuestions,
        }];
      }

      const agentTableWithEllis = extractAgentTableData(presentConversation);
      if (preferTable && agentTableWithEllis) {
        const textOnly = tableFromMd ? stripFirstMarkdownTable(ellisResponse) : ellisResponse;
        return [{
          id: Date.now().toString(),
          content: (textOnly && textOnly.trim()) || ellisResponse,
          type: MessageType.DATA_TABLE,
          role: "assistant",
          timestamp: new Date(),
          tableData: agentTableWithEllis,
          insightful_questions: insightfulQuestions,
        }];
      }

      return [{
        id: Date.now().toString(),
        content: ellisResponse,
        type: MessageType.TEXT,
        role: "assistant",
        timestamp: new Date(),
        insightful_questions: insightfulQuestions,
      }];
    }

    const agentTableOnly = extractAgentTableData(presentConversation);
    if (agentTableOnly && (preferTable || wantsTabularQuery(userInput))) {
      return [{
        id: Date.now().toString(),
        content: "",
        type: MessageType.DATA_TABLE,
        role: "assistant",
        timestamp: new Date(),
        tableData: agentTableOnly,
        insightful_questions: insightfulQuestions,
      }];
    }

    return null;
  }

  const { data, title, x_label, y_label } = graphData.graph_output.parameters;
  const functionName = graphData.graph_output.function_name;

  if (!data?.length || !functionName) {
    return [{
      id: Date.now().toString(),
      content: String(graphData.summary ?? ""),
      type: MessageType.TEXT,
      role: "assistant",
      timestamp: new Date(),
      insightful_questions: insightfulQuestions,
    }];
  }

  const filteredData = data.filter((item: any) => item.value !== null && item.value !== undefined);
  const baseChartData = {
    labels: filteredData.map((item: any) => item.label),
    datasets: [{
      data: filteredData.map((item: any) => item.value),
      label: y_label || 'Value',
    }],
  };

  const buildLineChartMessage = () => {
    const aggregatedData = data.reduce((acc: { [key: string]: number }, item: any) => {
      if (!acc[item.label]) acc[item.label] = 0;
      acc[item.label] += item.value || 0;
      return acc;
    }, {});

    const sortedLabels = Object.keys(aggregatedData).sort((a, b) => {
      const [yearA, quarterA] = a.split('-');
      const [yearB, quarterB] = b.split('-');
      return yearA === yearB ? quarterA.localeCompare(quarterB) : parseInt(yearA, 10) - parseInt(yearB, 10);
    });

    const chartData = {
      labels: sortedLabels,
      datasets: [{
        data: sortedLabels.map((label) => aggregatedData[label]),
        label: y_label || 'Value',
        borderColor: 'hsl(var(--chart-1))',
        backgroundColor: 'hsl(var(--chart-1))',
      }],
    };

    return {
      id: Date.now().toString(),
      content: String(graphData.summary ?? ""),
      type: MessageType.LINE_CHART,
      role: "assistant" as const,
      timestamp: new Date(),
      chartData,
      chartTitle: title,
      insightful_questions: insightfulQuestions,
    } satisfies Message;
  };

  const buildBarPieMessage = () => {
    const chartType = functionName === 'pie_chart' ? MessageType.PIE_CHART : MessageType.BAR_CHART;
    return {
      id: Date.now().toString(),
      content: String(graphData.summary ?? ""),
      type: chartType,
      role: "assistant" as const,
      timestamp: new Date(),
      chartData: {
        ...baseChartData,
        datasets: [{
          ...baseChartData.datasets[0],
          backgroundColor: ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'],
          borderColor: ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'],
        }],
      },
      chartTitle: title,
      insightful_questions: insightfulQuestions,
    } satisfies Message;
  };

  if (preferViz) {
    if (functionName === 'line_graph') {
      return [buildLineChartMessage()];
    }
    return [buildBarPieMessage()];
  }

  if (preferTable) {
    return [{
      id: Date.now().toString(),
      content: graphData.summary || "",
      type: MessageType.DATA_TABLE,
      role: "assistant",
      timestamp: new Date(),
      tableData: graphPointsToTableData(data, x_label, y_label),
      insightful_questions: insightfulQuestions,
    }];
  }

  if (data.length === 1) {
    return [{
      id: Date.now().toString(),
      content: String(graphData.summary ?? ""),
      type: MessageType.TEXT,
      role: "assistant",
      timestamp: new Date(),
      insightful_questions: insightfulQuestions,
    }];
  }

  if (functionName === 'line_graph') {
    return [buildLineChartMessage()];
  }

  return [buildBarPieMessage()];
}
