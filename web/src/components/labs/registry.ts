import { createElement, type ComponentType } from "react"
import dynamic from "next/dynamic"

import { LabLoading } from "./kit"

/**
 * Interactive labs, keyed by lesson id. Each lab is its own client-only chunk, loaded
 * only when a lesson that has one is opened. Lessons without an entry show no lab.
 */
export interface LabEntry {
  /** Short label for the on-this-page nav. */
  title: string
  Component: ComponentType
}

const loading = () => createElement(LabLoading)

const GradientDescent = dynamic(() => import("./gradient-descent-lab").then((m) => m.GradientDescentLab), { ssr: false, loading })
const OptimizerRace = dynamic(() => import("./gradient-descent-lab").then((m) => m.OptimizerRaceLab), { ssr: false, loading })
const Activations = dynamic(() => import("./activations-lab").then((m) => m.ActivationsLab), { ssr: false, loading })
const Attention = dynamic(() => import("./attention-lab").then((m) => m.AttentionLab), { ssr: false, loading })
const MultiHeadAttention = dynamic(() => import("./attention-lab").then((m) => m.MultiHeadAttentionLab), { ssr: false, loading })
const Logistic = dynamic(() => import("./logistic-lab").then((m) => m.LogisticLab), { ssr: false, loading })
const KMeans = dynamic(() => import("./kmeans-lab").then((m) => m.KMeansLab), { ssr: false, loading })
const Pca = dynamic(() => import("./pca-lab").then((m) => m.PcaLab), { ssr: false, loading })
const TreeSplit = dynamic(() => import("./tree-split-lab").then((m) => m.TreeSplitLab), { ssr: false, loading })
const Drift = dynamic(() => import("./drift-lab").then((m) => m.DriftLab), { ssr: false, loading })
const Bootstrap = dynamic(() => import("./bootstrap-lab").then((m) => m.BootstrapLab), { ssr: false, loading })
const AbPower = dynamic(() => import("./ab-power-lab").then((m) => m.AbPowerLab), { ssr: false, loading })
const BTree = dynamic(() => import("./btree-lab").then((m) => m.BTreeLab), { ssr: false, loading })
const Dag = dynamic(() => import("./dag-lab").then((m) => m.DagLab), { ssr: false, loading })
const StreamingWindows = dynamic(() => import("./streaming-lab").then((m) => m.StreamingWindowsLab), { ssr: false, loading })
const Convolution = dynamic(() => import("./convolution-lab").then((m) => m.ConvolutionLab), { ssr: false, loading })

export const LABS: Record<string, LabEntry> = {
  gradient_descent_intuition: { title: "Gradient descent", Component: GradientDescent },
  optimizers_intuition: { title: "Optimizer race", Component: OptimizerRace },
  activations_and_backprop: { title: "Activation functions", Component: Activations },
  attention_intuition: { title: "Attention weights", Component: Attention },
  mha_rope: { title: "Multi-head attention", Component: MultiHeadAttention },
  logistic_svm_intuition: { title: "Decision boundary", Component: Logistic },
  clustering_kmeans_gmm: { title: "K-means step-through", Component: KMeans },
  pca_intuition: { title: "PCA explorer", Component: Pca },
  trees_and_forests: { title: "Split explorer", Component: TreeSplit },
  drift_monitoring: { title: "Drift monitor", Component: Drift },
  sampling_bootstrap: { title: "Bootstrap", Component: Bootstrap },
  ab_testing: { title: "A/B test power", Component: AbPower },
  indexes_and_transactions: { title: "Index vs full scan", Component: BTree },
  orchestration_dags: { title: "DAG scheduler", Component: Dag },
  streaming_cdc: { title: "Streaming windows", Component: StreamingWindows },
  cnn_convolutions: { title: "Convolution", Component: Convolution },
}

export function getLab(lessonId: string): LabEntry | null {
  return LABS[lessonId] ?? null
}
