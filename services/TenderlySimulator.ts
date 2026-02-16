import { ChainId } from "@storyhunt/sdk-core"
import axios, { AxiosRequestConfig } from "axios"
import http from "http"
import https from "https"
import EnvHandler from "./EnvHandler"

export enum SimulationStatus {
  NotSupported = 0,
  Failed = 1,
  Succeeded = 2,
  InsufficientBalance = 3,
  NotApproved = 4,
  SystemDown = 5,
  SlippageTooLow = 6,
  TransferFromFailed = 7,
}

export function breakDownTenderlySimulationError(
  data?: string,
): SimulationStatus {
  if (data) {
    switch (data) {
      case "0x739dbe52": // V3TooMuchRequested
      case "0x39d35496": // V3TooLittleReceived
      case "0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000025556e697377617056323a20494e53554646494349454e545f4f55545055545f414d4f554e54000000000000000000000000000000000000000000000000000000": // INSUFFICIENT_OUTPUT_AMOUNT
      case "0x08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000034949410000000000000000000000000000000000000000000000000000000000": // IIA
        return SimulationStatus.SlippageTooLow
      case "0x08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000145452414e534645525f46524f4d5f4641494c4544000000000000000000000000": // TRANSFER_FROM_FAILED
        return SimulationStatus.TransferFromFailed
      case "0x675cae38": // InsufficientToken
        return SimulationStatus.InsufficientBalance
      default:
        return SimulationStatus.Failed
    }
  }

  return SimulationStatus.Failed
}

export type SimulationResult = {
  transaction: {
    hash: string
    gas_used: number
    gas: number
    error_message: string
  }
  simulation: { state_overrides: Record<string, unknown> }
}

export type TenderlyResponse = {
  config: {
    url: string
    method: string
    data: string
  }
  simulation_results: [SimulationResult, SimulationResult]
}

export type GasBody = {
  gas: string
  gasUsed: string
}

// Standard JSON RPC error response https://www.jsonrpc.org/specification#error_object
export type JsonRpcError = {
  error: {
    code: number
    message: string
    data: string
  }
}

export type TenderlyResponseEstimateGasBundle = {
  id: number
  jsonrpc: string
  result: Array<JsonRpcError | GasBody>
}

export enum TenderlySimulationType {
  QUICK = "quick",
  FULL = "full",
  ABI = "abi",
}

export type TenderlySimulationRequest = {
  save: boolean
  save_if_fails: boolean
  estimate_gas: boolean
  network_id: ChainId
  input: string
  to: string
  value: string
  from: string
  simulation_type: TenderlySimulationType
  block_number?: number
}

const TENDERLY_SIMULATE_API = (
  tenderlyBaseUrl: string,
  tenderlyUser: string,
  tenderlyProject: string,
) =>
  `${tenderlyBaseUrl}/api/v1/account/${tenderlyUser}/project/${tenderlyProject}/simulate`

const TENDERLY_BATCH_SIMULATE_API = (
  tenderlyBaseUrl: string,
  tenderlyUser: string,
  tenderlyProject: string,
) =>
  `${tenderlyBaseUrl}/api/v1/account/${tenderlyUser}/project/${tenderlyProject}/simulate-batch`

const TENDERLY_BUNDLE_SIMULATE_API = (
  tenderlyBaseUrl: string,
  tenderlyUser: string,
  tenderlyProject: string,
) =>
  `${tenderlyBaseUrl}/api/v1/account/${tenderlyUser}/project/${tenderlyProject}/simulate-bundle`

// We multiply tenderly gas limit by this to overestimate gas limit
const DEFAULT_ESTIMATE_MULTIPLIER = 1.3
const DEFAULT_ESTIMATE_TIMEOUT = 8000

export class TenderlySimulator {
  static instance: TenderlySimulator | null = null
  private tenderlyBaseUrl: string
  private tenderlyUser: string
  private tenderlyProject: string
  private tenderlyAccessKey: string
  private overrideEstimateMultiplier: number
  private tenderlyRequestTimeout?: number
  private tenderlyServiceInstance = axios.create({
    // keep connections alive,
    // maxSockets default is Infinity, so Infinity is read as 50 sockets
    httpAgent: new http.Agent({ keepAlive: true }),
    httpsAgent: new https.Agent({ keepAlive: true }),
  })

  private constructor(
    overrideEstimateMultiplier?: number,
    tenderlyRequestTimeout?: number,
  ) {
    this.tenderlyBaseUrl =
      EnvHandler.getInstance().getVariable("tenderlyBaseUrl")
    this.tenderlyUser = EnvHandler.getInstance().getVariable("tenderlyUser")
    this.tenderlyProject =
      EnvHandler.getInstance().getVariable("tenderlyProject")
    this.tenderlyAccessKey =
      EnvHandler.getInstance().getVariable("tenderlyAccessKey")
    this.overrideEstimateMultiplier =
      overrideEstimateMultiplier ?? DEFAULT_ESTIMATE_MULTIPLIER
    this.tenderlyRequestTimeout = tenderlyRequestTimeout ?? DEFAULT_ESTIMATE_TIMEOUT
    console.log("TenderlySimulator initialized");
  }

  static getInstance(
    overrideEstimateMultiplier?: number,
    tenderlyRequestTimeout?: number,
  ): TenderlySimulator {
    if (!TenderlySimulator.instance) {
      TenderlySimulator.instance = new TenderlySimulator(
        overrideEstimateMultiplier,
        tenderlyRequestTimeout,
      )
    }

    return TenderlySimulator.instance
  }

  public async simulateTransaction(
    simulations: TenderlySimulationRequest[],
    simulation_txn_kind: "bundle" | "single" | "batch" = "batch",
  ) {
    try {
      const body = { simulations }
      const opts: AxiosRequestConfig = {
        headers: {
          "X-Access-Key": this.tenderlyAccessKey,
        },
        timeout: this.tenderlyRequestTimeout,
      }

      const url =
        simulation_txn_kind === "single"
          ? TENDERLY_SIMULATE_API(
              this.tenderlyBaseUrl,
              this.tenderlyUser,
              this.tenderlyProject,
            )
          : simulation_txn_kind === "batch"
            ? TENDERLY_BATCH_SIMULATE_API(
                this.tenderlyBaseUrl,
                this.tenderlyUser,
                this.tenderlyProject,
              )
            : TENDERLY_BUNDLE_SIMULATE_API(
                this.tenderlyBaseUrl,
                this.tenderlyUser,
                this.tenderlyProject,
              )

      const before = Date.now()

      const { data: response } =
        await this.tenderlyServiceInstance.post<TenderlyResponse>(
          url,
          body,
          opts,
        )

      const latencies = Date.now() - before
      console.log(
        `Tenderly simulation request body: ${JSON.stringify(body)}, having latencies ${latencies} in milliseconds.`,
      )
      console.log("Tenderly simulation response:", response)

      // Validate tenderly response body
      if (
        !response ||
        !response.simulation_results.length ||
        !response.simulation_results[0].transaction ||
        response.simulation_results[0].transaction.error_message
      ) {
        console.log(
          `Failed to Simulate Via Tenderly!`,
          response.simulation_results[0].transaction.error_message,
        )
        return { simulationStatus: SimulationStatus.Failed }
      }

      // Parse the gas used in the simulation response object, and then pad it so that we overestimate.
      const estimatedGasUsed = BigInt(
        (
          response.simulation_results[0].transaction.gas *
          this.overrideEstimateMultiplier
        ).toFixed(0),
      )

      return {
        estimatedGasUsed,
        simulationStatus: SimulationStatus.Succeeded,
      }
    } catch (error: any) {
      console.log(`Error when Simulating Via Tenderly!`, error)
      return {
        simulationStatus: SimulationStatus.Failed,
        error: breakDownTenderlySimulationError(error.message),
      }
    }
  }
}
