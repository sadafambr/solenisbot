import { Message, MessageType } from "./types";

export async function askAlgo(userInput: string, conversationHistory: any[] = [], chatId?: string) {
  try {
    const response = await fetch('http://localhost:5000/solenis-bot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: 1,
        user_input: userInput,
        conversation_history: conversationHistory,
        chat_id: chatId,
      }),
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    return await response.json();
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

export function transformApiResponseToCharts(apiResponse: any) {
  // Check if this is a clarification request
  if (apiResponse.requires_clarification) {
    return [{
      id: Date.now().toString(),
      content: apiResponse.clarification_question,
      type: MessageType.CLARIFICATION,
      role: "assistant",
      timestamp: new Date(),
      clarification_question: apiResponse.clarification_question,
      requires_clarification: true,
    }];
  }

  const graphData = apiResponse.conversation.present_conversation.find(
    (item: any) => item.graph_and_summary_agent
  )?.graph_and_summary_agent;

  // Extract insightful questions from present_conversation
  const insightfulQuestions = apiResponse.conversation.present_conversation.find(
    (item: any) => item.insightful_questions
  )?.insightful_questions;

  if (!graphData) return null;

  const { data, title, x_label, y_label } = graphData.graph_output.parameters;
  const functionName = graphData.graph_output.function_name;

  // If there's no data or empty function name, return just the summary as a text message
  if (!data?.length || !functionName) {
    return [{
      id: Date.now().toString(),
      content: graphData.summary,
      type: MessageType.TEXT,
      role: "assistant",
      timestamp: new Date(),
      insightful_questions: insightfulQuestions,
    }];
  }

  // If there's only one data point, return just the summary as a text message
  if (data.length === 1) {
    return [{
      id: Date.now().toString(),
      content: graphData.summary,
      type: MessageType.TEXT,
      role: "assistant",
      timestamp: new Date(),
      insightful_questions: insightfulQuestions,
    }];
  }

  // For line graphs, aggregate values by fiscal period
  if (functionName === 'line_graph') {
    const aggregatedData = data.reduce((acc: { [key: string]: number }, item: any) => {
      if (!acc[item.label]) {
        acc[item.label] = 0;
      }
      acc[item.label] += item.value || 0;
      return acc;
    }, {});

    // Sort periods chronologically
    const sortedLabels = Object.keys(aggregatedData).sort((a, b) => {
      const [yearA, quarterA] = a.split('-');
      const [yearB, quarterB] = b.split('-');
      return yearA === yearB ?
        quarterA.localeCompare(quarterB) :
        parseInt(yearA) - parseInt(yearB);
    });

    const chartData = {
      labels: sortedLabels,
      datasets: [{
        data: sortedLabels.map(label => aggregatedData[label]),
        label: y_label || 'Value',
        borderColor: 'hsl(var(--chart-1))',
        backgroundColor: 'hsl(var(--chart-1))',
      }],
    };

    return [{
      id: Date.now().toString(),
      content: graphData.summary,
      type: MessageType.LINE_CHART,
      role: "assistant",
      timestamp: new Date(),
      chartData,
      chartTitle: title,
      insightful_questions: insightfulQuestions,
    }];
  }

  // Handle pie and bar charts
  const filteredData = data.filter((item: any) => item.value !== null && item.value !== undefined);
  const baseChartData = {
    labels: filteredData.map((item: any) => item.label),
    datasets: [{
      data: filteredData.map((item: any) => item.value),
      label: y_label || 'Value',
    }],
  };

  const chartType = functionName === 'pie_chart' ? MessageType.PIE_CHART : MessageType.BAR_CHART;

  return [{
    id: Date.now().toString(),
    content: graphData.summary,
    type: chartType,
    role: "assistant",
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
  }];
}
